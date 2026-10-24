import { type Config, type Presets } from "./Config";

export const builtinPresets = {
    "Whisper Base (CPU)": {
        executor: "whisper.cpp",
        backendDirectory: "whisper-cpu",
        modelDirectory: "whisper-base",
        params: { "--language": "auto", "--no-gpu": "" }
    },
    "Whisper Large v3 Turbo (CUDA 12.4)": {
        executor: "whisper.cpp",
        backendDirectory: "whisper-cuda-12",
        modelDirectory: "whisper-large-v3-turbo",
        params: { "--language": "auto" }
    },
    "Paraformer zh (CPU)": {
        executor: "sherpa-onnx",
        backendDirectory: "sherpa-cpu",
        modelDirectory: "sherpa-paraformer-zh",
        params: { "--provider": "cpu", "--decoding-method": "greedy_search" }
    },
    "Paraformer zh (CUDA 12)": {
        executor: "sherpa-onnx",
        backendDirectory: "sherpa-cuda-12",
        modelDirectory: "sherpa-paraformer-zh",
        params: { "--provider": "cuda", "--decoding-method": "greedy_search" }
    }
} as const satisfies Presets;

export type Preset = {
    readonly name: string;
    readonly config: Config;
    readonly deletable: boolean;
};

export function mergePresets(stored: Presets): Preset[] {
    const names = new Set([...Object.keys(builtinPresets), ...Object.keys(stored)]);
    const builtins = Object.entries(builtinPresets).map(([base, config]) => {
        let name = base;
        // Preserve stored names and only disambiguate the built-in display name.
        if (Object.hasOwn(stored, base)) {
            for (let suffix = 2; names.has(name); suffix++) name = `${base} ${suffix}`;
            names.add(name);
        }
        return { name, config, deletable: false };
    });
    return [...Object.entries(stored).map(([name, config]) => ({ name, config, deletable: true })), ...builtins];
}