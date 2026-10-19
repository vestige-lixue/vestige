import { readdir } from "node:fs/promises";
import { type AbsolutePath } from "../../../shared/util/path";

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

export async function modelArguments(directory: AbsolutePath): Promise<string[]> {
    const names = new Set(await readdir(directory));
    const files = [
        ["tokens", "tokens.txt"],
        ...modelOptions.map(option => [option, `${option}.onnx`]),
        ["funasr-nano-tokenizer", "funasr-nano-tokenizer"],
        ["qwen3-asr-tokenizer", "qwen3-asr-tokenizer"]
    ];
    return files.filter(([, name]) => names.has(name)).map(([option, name]) => `--${option}=models/${name}`);
}