import { type Run } from "./Run";

export type Executer = "sherpa-onnx" | "whisper.cpp";

export type TranscriptionRequest = {
    executer: Executer;
    // Absolute path, or relative to <profile>/models. Native model file options are resolved against this directory.
    modelDirectory: string;
    mediaPath: string;
    // JSON text containing native CLI option names and values.
    // Model compatibility and parameter semantics are checked by the executer.
    params: string;
};

export type TranscriptionResult = ({
    ok: true;
    run: Run;
} | {
    ok: false;
    error: string;
});

export const executerChannel = "transcription:transcribe";