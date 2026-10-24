import { toFailureInfo } from "../../shared/failure";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, filePath, InvalidPathFailure, isSystemError } from "../util/file";
import { type Run } from "../../shared/transcription/Run";
import { type TranscriptionResult } from "../../shared/transcription/executer";
import { waveDuration } from "./audio";
import { type ParsedRequest, parseRequest } from "./parameters";
import { findExecutable, NativeProcessFailure, runProcess, type ProcessOutputListener } from "../util/process";
import { execute as executeSherpa } from "./sherpa/execute";
import { execute as executeWhisper } from "./whisper/execute";
import { TranscriptionFailure } from "./failure";
import { resolveBackend, type BackendLocation } from "../backends/resolve";

export type ExecutionPaths = {
    runtimeDirectory: AbsolutePath;
    modelDirectory: AbsolutePath;
    backendDirectory: AbsolutePath;
    temporaryDirectory: AbsolutePath;
};

export type ExecutionFeedback = {
    output: ProcessOutputListener;
    progress: (value: number | null) => void;
    record?: (event: string, value: unknown) => void;
};

export type ExecutionContext = {
    id: string;
    request: ParsedRequest;
    backend: BackendLocation;
    directory: AbsolutePath;
    audio: AbsolutePath;
    duration: number;
    runtimeDirectory: AbsolutePath;
    signal?: AbortSignal;
    feedback?: ExecutionFeedback;
};

export async function transcribe(id: string, value: unknown, paths: ExecutionPaths, signal?: AbortSignal, feedback?: ExecutionFeedback): Promise<TranscriptionResult> {
    try {
        const run = await executeTask(id, value, paths, signal, feedback);
        signal?.throwIfAborted();
        return { success: true, run };
    }
    catch (error) {
        console.error("Transcription failed:", error);
        if (signal?.aborted && error === signal.reason) return { success: false, error: { kind: "transcription-cancelled" } };
        if (error instanceof TranscriptionFailure || error instanceof NativeProcessFailure || error instanceof InvalidPathFailure || isSystemError(error)) {
            return { success: false, error: toFailureInfo(error) };
        }
        throw error;
    }
}

async function executeTask(id: string, value: unknown, paths: ExecutionPaths, signal?: AbortSignal, feedback?: ExecutionFeedback): Promise<Run> {
    const request = parseRequest(value, paths.modelDirectory);
    feedback?.record?.("Transcription request", request);
    const backend = await resolveBackend(request.executer, request.backendDirectory, paths.backendDirectory);
    feedback?.record?.("Backend", backend);
    const ffmpeg = await findExecutable(paths.runtimeDirectory, "ffmpeg", "ffmpeg");
    feedback?.record?.("FFmpeg executable", ffmpeg);
    signal?.throwIfAborted();
    const root = paths.temporaryDirectory;
    await mkdir(root, { recursive: true });
    const directory = filePath(await mkdtemp(join(root, "task-")));
    try {
        // Native Windows CLIs may use narrow argv. A task-local link keeps the
        // model's parent path out of argv without copying large model files.
        await symlink(request.modelDirectory, join(directory, "models"), process.platform === "win32" ? "junction" : "dir");
        const audio = filePath(join(directory, "audio.wav"));
        feedback?.output("stderr", "[ffmpeg] Preparing audio.\n");
        await runProcess(ffmpeg, [
            "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", request.mediaPath,
            "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "wav", audio
        ], directory, signal, feedback?.output);
        const duration = await waveDuration(audio);
        feedback?.record?.("Audio duration", { media: request.mediaDuration, prepared: duration });
        const execute = request.executer === "sherpa-onnx" ? executeSherpa : executeWhisper;
        feedback?.output("stderr", `[${request.executer}] Transcribing.\n`);
        const run = await execute({ id, request, backend, directory, audio, duration, runtimeDirectory: paths.runtimeDirectory, signal, feedback });
        const outside = run.transcript.flatMap((segment, index) => segment.range.end > request.mediaDuration ? [{ index, ...segment.range }] : []);
        if (outside.length) feedback?.record?.("Timestamps beyond media duration", { duration: request.mediaDuration, segments: outside });
        return run;
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