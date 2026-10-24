import { type Executor } from "../../shared/transcription/executor";
import { type RunDraft } from "./result";
import { type AbsolutePath } from "../../shared/util/path";
import { type ExecutionContext } from "./execute";
import { type ModelPlan } from "./ModelPlan";
import { execute as executeSherpa } from "./sherpa/execute";
import { resolveModel as resolveSherpaModel } from "./sherpa/models";
import { execute as executeWhisper } from "./whisper/execute";
import { resolveModel as resolveWhisperModel } from "./whisper/models";

export type ExecutorTool = "vad";

export type ExecutorAdapter = {
    readonly program: string;
    readonly tools: Readonly<Partial<Record<ExecutorTool, { program: string; requiredInPackage: boolean }>>>;
    readonly resolveModel: (directory: AbsolutePath, options: Readonly<Record<string, string>>) => ModelPlan | Promise<ModelPlan>;
    readonly execute: (context: ExecutionContext) => Promise<RunDraft>;
};

export const executorAdapters: Readonly<Record<Executor, ExecutorAdapter>> = {
    "whisper.cpp": {
        program: "whisper-cli",
        tools: {},
        resolveModel: resolveWhisperModel,
        execute: executeWhisper
    },
    "sherpa-onnx": {
        program: "sherpa-onnx-offline",
        tools: { vad: { program: "sherpa-onnx-vad", requiredInPackage: true } },
        resolveModel: resolveSherpaModel,
        execute: executeSherpa
    }
};