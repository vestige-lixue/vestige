import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { type Run } from "../../shared/transcription/Run";
import { waveDuration } from "./audio";
import { type ParsedRequest, parseRequest } from "./parameters";
import { findExecutable, runProcess } from "./process";
import { execute as executeSherpa } from "./sherpa/execute";
import { execute as executeWhisper } from "./whisper/execute";

export type ExecutionPaths = {
    runtimeDirectory: string;
    modelDirectory: string;
    temporaryDirectory: string;
};

export type ExecutionContext = {
    request: ParsedRequest;
    runtimeDirectory: string;
    directory: string;
    audio: string;
    duration: number;
    signal?: AbortSignal;
};

export async function transcribe(value: unknown, paths: ExecutionPaths, signal?: AbortSignal): Promise<Run> {
    const request = parseRequest(value);
    request.modelDirectory = resolve(paths.modelDirectory, request.modelDirectory);
    if (!isAbsolute(request.mediaPath)) throw new Error("mediaPath must be an absolute path.");
    const ffmpeg = await findExecutable(paths.runtimeDirectory, "ffmpeg", "ffmpeg");
    signal?.throwIfAborted();
    const root = resolve(paths.temporaryDirectory);
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(join(root, "task-"));
    try {
        // Native Windows CLIs may use narrow argv. A task-local link keeps the
        // model's parent path out of argv without copying large model files.
        await symlink(request.modelDirectory, join(directory, "models"), process.platform === "win32" ? "junction" : "dir");
        const audio = join(directory, "audio.wav");
        await runProcess(ffmpeg, [
            "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", request.mediaPath,
            "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "wav", audio
        ], directory, signal);
        const duration = await waveDuration(audio);
        const execute = request.executer === "sherpa-onnx" ? executeSherpa : executeWhisper;
        return await execute({ request, runtimeDirectory: paths.runtimeDirectory, directory, audio, duration, signal });
    }
    finally {
        // Only remove the directory created for this invocation, inside our root.
        const child = relative(root, resolve(directory));
        if (child && !child.startsWith("..") && !isAbsolute(child)) {
            await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(error => {
                // Cleanup failures must not replace a native diagnostic or a valid Run.
                console.warn("Could not remove transcription temporary directory:", directory, error);
            });
        }
    }
}