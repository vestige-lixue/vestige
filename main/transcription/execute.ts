import { toFailure } from "../../shared/failure";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, filePath, InvalidPathError, isSystemError } from "../util/file";
import { type Run } from "../../shared/transcription/Run";
import { type TranscriptionResult } from "../../shared/transcription/executer";
import { waveDuration } from "./audio";
import { type ParsedRequest, parseRequest } from "./parameters";
import { findExecutable, NativeProcessError, runProcess } from "../util/process";
import { execute as executeSherpa } from "./sherpa/execute";
import { execute as executeWhisper } from "./whisper/execute";
import { TranscriptionError } from "./failure";

export type ExecutionPaths = {
    runtimeDirectory: AbsolutePath;
    modelDirectory: AbsolutePath;
    temporaryDirectory: AbsolutePath;
};

export type ExecutionContext = {
    id: string;
    request: ParsedRequest;
    runtimeDirectory: AbsolutePath;
    directory: AbsolutePath;
    audio: AbsolutePath;
    duration: number;
    signal?: AbortSignal;
};

export async function transcribe(id: string, value: unknown, paths: ExecutionPaths, signal?: AbortSignal): Promise<TranscriptionResult> {
    try {
        return { success: true, run: await executeTask(id, value, paths, signal) };
    }
    catch (error) {
        console.error("Transcription failed:", error);
        if (signal?.aborted && error === signal.reason) return { success: false, error: { kind: "transcription-cancelled" } };
        if (error instanceof TranscriptionError || error instanceof NativeProcessError || error instanceof InvalidPathError || isSystemError(error)) {
            return { success: false, error: toFailure(error) };
        }
        throw error;
    }
}

async function executeTask(id: string, value: unknown, paths: ExecutionPaths, signal?: AbortSignal): Promise<Run> {
    const request = parseRequest(value, paths.modelDirectory);
    const ffmpeg = await findExecutable(paths.runtimeDirectory, "ffmpeg", "ffmpeg");
    signal?.throwIfAborted();
    const root = paths.temporaryDirectory;
    await mkdir(root, { recursive: true });
    const directory = filePath(await mkdtemp(join(root, "task-")));
    try {
        // Native Windows CLIs may use narrow argv. A task-local link keeps the
        // model's parent path out of argv without copying large model files.
        await symlink(request.modelDirectory, join(directory, "models"), process.platform === "win32" ? "junction" : "dir");
        const audio = filePath(join(directory, "audio.wav"));
        await runProcess(ffmpeg, [
            "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", request.mediaPath,
            "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "wav", audio
        ], directory, signal);
        const duration = await waveDuration(audio);
        const execute = request.executer === "sherpa-onnx" ? executeSherpa : executeWhisper;
        return await execute({ id, request, runtimeDirectory: paths.runtimeDirectory, directory, audio, duration, signal });
    }
    finally {
        // Only remove the directory created for this invocation, inside our root.
        if (directory !== root && containsPath(root, directory)) {
            await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(error => {
                // Cleanup failures must not replace a native diagnostic or a valid Run.
                console.warn("Could not remove transcription temporary directory:", directory, error);
            });
        }
    }
}