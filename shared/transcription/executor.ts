import { type FailureInfo } from "../failure";
import { type Run } from "./Run";
import { type AbsolutePath } from "../util/path";

export const executors = [
    { id: "whisper.cpp", name: "whisper.cpp" },
    { id: "sherpa-onnx", name: "sherpa-onnx" }
] as const;

export type Executor = typeof executors[number]["id"];

export function isExecutor(value: unknown): value is Executor {
    return executors.some(executor => executor.id === value);
}

export type TranscriptionRequest = {
    executor: Executor;
    backendDirectory: string;
    // Absolute path, or relative to the user's models folder. The executor owns its file layout.
    modelDirectory: string;
    mediaPath: AbsolutePath;
    mediaDuration: number;
    // JSON text containing verbatim native CLI option names (including dashes) and string values.
    // An empty value emits only the key. No boolean/number or path conversion is performed.
    // The user chooses a compatible model; native programs interpret these parameters.
    params: string;
};

export type TranscriptionResult = ({
    success: true;
    run: Run;
} | {
    success: false;
    error: FailureInfo;
});

export const executorChannel = "transcription:transcribe";
export const cancelExecutorChannel = "transcription:cancel";