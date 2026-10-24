import { type NonNegativeInteger, type NonNegativeNumber, type Probability } from "../util/Scalar";
import { type Range } from "../util/range";
import { type Executor, type TranscriptionRequest } from "./executor";

// Historical paths are evidence, not live filesystem capabilities. They may
// belong to another machine; loading a project never dereferences them.
export type ExecutableRecord = { path: string; version: string | null; sha256: string | null };
export type TaskLogReference = { taskId: string; path: string };
export type DecodeProblem = "context" | "tokens" | "repetition" | "prompt";

export type ExecutionPlan = {
    executor: Executor;
    backend: { directory: string; program: ExecutableRecord; tools: { role: string; program: ExecutableRecord | null; model: { path: string; sha256: string | null } | null; required: boolean }[] };
    model: { directory: string; files: { role: string; path: string; sha256: string | null }[] };
    audio: { program: ExecutableRecord; stream: "0:a:0"; sampleRate: 16000; channels: 1; format: "pcm-s16le"; duration: NonNegativeNumber };
    options: Record<string, string>;
    // Only supplied flags and application defaults are known; CLI defaults are not introspected.
    nativeDefaults: null;
    strategy: { kind: "native"; version: 1 } | { kind: "qwen3-asr"; version: 1; fallbackTemperature: Probability | null };
    segmentation: { maximumDuration: NonNegativeNumber | null; batchSize: NonNegativeInteger };
    parts: Range[];
};

export type ExecutionDeviation = {
    originalRange: Range;
    range: Range;
    options: Record<string, string>;
    reasons: DecodeProblem[];
};

export type Execution = {
    request: Omit<TranscriptionRequest, "mediaPath"> & { mediaPath: string };
    plan: ExecutionPlan;
    deviations: ExecutionDeviation[];
    // Clearing logs or moving this project may invalidate this reference.
    log: TaskLogReference | null;
};