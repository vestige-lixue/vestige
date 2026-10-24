import { readdir } from "node:fs/promises";
import { type AbsolutePath } from "../../../shared/util/path";
import { type ModelPlan } from "../ModelPlan";

// A directory contains one model. Each ONNX file is named after its native
// option, with an .onnx extension; tokens are always tokens.txt. There is no
// search for arbitrary ONNX files or preference between quantized variants.
const modelOptions = [
    "encoder", "decoder", "joiner", "paraformer", "medasr", "fire-red-asr-ctc", "telespeech-ctc",
    "moonshine-encoder", "moonshine-decoder", "moonshine-merged-decoder", "moonshine-preprocessor",
    "moonshine-cached-decoder", "moonshine-uncached-decoder", "whisper-encoder", "whisper-decoder",
    "nemo-ctc-model", "tdnn-model", "zipformer-ctc-model", "dolphin-model", "wenet-ctc-model", "sense-voice-model",
    "omnilingual-asr-model", "canary-encoder", "canary-decoder", "fire-red-asr-encoder", "fire-red-asr-decoder",
    "cohere-transcribe-encoder", "cohere-transcribe-decoder", "funasr-nano-encoder-adaptor", "funasr-nano-llm",
    "funasr-nano-embedding", "qwen3-asr-encoder", "qwen3-asr-conv-frontend", "qwen3-asr-decoder"
];

export async function resolveModel(directory: AbsolutePath, requested: Readonly<Record<string, string>>): Promise<ModelPlan> {
    const names = new Set(await readdir(directory));
    const files = [
        ["tokens", "tokens.txt"],
        ...modelOptions.map(option => [option, `${option}.onnx`]),
        ["funasr-nano-tokenizer", "funasr-nano-tokenizer"],
        ["qwen3-asr-tokenizer", "qwen3-asr-tokenizer"]
    ];
    const roles = files.filter(([, name]) => names.has(name)).map(([role, filename]) => ({ role, filename }));
    const options = { ...requested };
    const hasOption = (name: string): boolean => Object.keys(options).some(key => key === name || key.startsWith(name + "="));
    // Read semantic model roles/options once, before constructing native argv.
    const qwen = roles.some(file => file.role === "qwen3-asr-decoder") || hasOption("--qwen3-asr-decoder");
    if (qwen && !hasOption("--qwen3-asr-max-new-tokens")) options["--qwen3-asr-max-new-tokens"] = "256";
    return {
        files: roles,
        options,
        strategy: qwen ? { kind: "qwen3-asr", fallbackTemperature: hasOption("--qwen3-asr-temperature") ? null : 0.4 } : { kind: "native" }
    };
}