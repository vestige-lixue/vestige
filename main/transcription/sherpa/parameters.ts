import { argumentValue, modelPath, optionName } from "../parameters";

// Only native file options are resolved; arbitrary options and text stay opaque.
const fileOptions = new Set([
    "tokens", "encoder", "decoder", "joiner", "paraformer", "medasr", "fire-red-asr-ctc", "telespeech-ctc",
    "moonshine-encoder", "moonshine-decoder", "moonshine-merged-decoder", "moonshine-preprocessor",
    "moonshine-cached-decoder", "moonshine-uncached-decoder", "whisper-encoder", "whisper-decoder",
    "nemo-ctc-model", "tdnn-model", "zipformer-ctc-model", "dolphin-model", "wenet-ctc-model", "sense-voice-model",
    "omnilingual-asr-model", "canary-encoder", "canary-decoder", "fire-red-asr-encoder", "fire-red-asr-decoder",
    "cohere-transcribe-encoder", "cohere-transcribe-decoder", "funasr-nano-encoder-adaptor", "funasr-nano-llm",
    "funasr-nano-embedding", "funasr-nano-tokenizer", "qwen3-asr-encoder", "qwen3-asr-conv-frontend",
    "qwen3-asr-decoder", "qwen3-asr-tokenizer", "bpe-vocab", "lm", "lodr-fst", "ctc.graph", "hr-lexicon",
    "hr-dict-dir", "hotwords-file", "config"
]);
const fileLists = new Set(["paraformer", "hr-rule-fsts", "rule-fsts", "rule-fars"]);

export function nativeArguments(params: Record<string, unknown>, modelDirectory: string): string[] {
    return Object.entries(params).map(([key, value]) => {
        const name = optionName(key);
        const list = fileLists.has(name) || name.endsWith(".qnn-context-binary");
        const file = fileOptions.has(name) || /\.qnn-(backend|system)-lib$/.test(name);
        if (typeof value === "string" && value && (file || list)) {
            value = list ? value.split(",").map(path => path ? modelPath(path, modelDirectory) : path).join(",")
                : modelPath(value, modelDirectory);
        }
        // Sherpa's ParseOptions accepts --name=value, including booleans.
        return "--" + name + "=" + argumentValue(value);
    });
}