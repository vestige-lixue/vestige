import { type FailureInfo } from "../failure";
import { type Run } from "./Run";
import { type AbsolutePath } from "../util/path";

export type Executer = "sherpa-onnx" | "whisper.cpp";

export const executers = {
    "whisper.cpp": { program: "whisper-cli" },
    "sherpa-onnx": { program: "sherpa-onnx-offline" }
} as const satisfies Record<Executer, { program: string }>;

export type TranscriptionRequest = {
    executer: Executer;
    backendDirectory: string;
    // Absolute path, or relative to the user's models folder. The executer owns its file layout.
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

export const executerChannel = "transcription:transcribe";
export const cancelExecuterChannel = "transcription:cancel";