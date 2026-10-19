import { type Model } from "../../shared/models";
import { type DownloadPayload } from "../downloads/types";

export type DownloadConfiguration = Model & DownloadPayload & { estimatedBytes: number };

const whisperSource = "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1";
const paraformerSource = "https://huggingface.co/csukuangfj/sherpa-onnx-paraformer-zh-2024-03-09/resolve/906992d326ebf0c5171cde675aa0902be9e5bc6c";

// Download metadata, filename mappings and attribution belong here.
// Transfer lengths are obtained from the server at runtime.
// Display estimates use the pinned revisions' file sizes, checked on 2026-10-15.
export const modelDownloads: DownloadConfiguration[] = [
    ...([
        ["tiny", "Tiny", 77_691_713],
        ["base", "Base", 147_951_465],
        ["small", "Small", 487_601_967],
        ["large-v3-turbo", "Large v3 Turbo", 1_624_555_275]
    ] as const).map(([variant, name, estimatedBytes]): DownloadConfiguration => ({
        id: `whisper-${variant}`,
        name: `Whisper ${name}`,
        estimatedBytes,
        executer: "whisper.cpp",
        files: [
            { url: `${whisperSource}/ggml-${variant}.bin?download=true`, destination: "ggml-base.en.bin" },
            { url: "https://raw.githubusercontent.com/openai/whisper/main/LICENSE", destination: "LICENSE" }
        ],
        notice: [
            `OpenAI Whisper ${name}`, "Copyright (c) 2022 OpenAI", "License: MIT",
            "Source and model-weight license: https://github.com/openai/whisper#license",
            "GGML conversion and distribution: Georgi Gerganov / whisper.cpp contributors",
            whisperSource.replace("/resolve/", "/tree/"),
            `Vestige filename mapping: ggml-${variant}.bin -> ggml-base.en.bin (contents unchanged).`
        ].join("\n")
    })),
    {
        id: "sherpa-paraformer-zh",
        name: "Paraformer zh",
        estimatedBytes: 822_641_426 + 75_354,
        executer: "sherpa-onnx",
        files: [
            { url: `${paraformerSource}/model.onnx?download=true`, destination: "paraformer.onnx" },
            { url: `${paraformerSource}/tokens.txt?download=true`, destination: "tokens.txt" },
            { url: "https://www.apache.org/licenses/LICENSE-2.0.txt", destination: "LICENSE" }
        ],
        notice: [
            "Paraformer zh (Paraformer-large Chinese model)",
            "Model authors/publisher: Alibaba DAMO Academy speech team / iic / FunASR",
            "License: Apache License 2.0",
            "Original model: iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8358-tensorflow1, revision v1.1.9",
            "https://www.modelscope.cn/models/iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8358-tensorflow1",
            "Versioned license declaration:",
            "https://modelscope.cn/api/v1/models/iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8358-tensorflow1/repo?Revision=v1.1.9&FilePath=README.md",
            "ONNX conversion and distribution: Fangjun Kuang (csukuangfj) / sherpa-onnx",
            paraformerSource.replace("/resolve/", "/tree/"),
            "Vestige filename mapping: model.onnx -> paraformer.onnx (contents unchanged); tokens.txt unchanged.",
            "Preserve any additional notices supplied with the actual model files."
        ].join("\n")
    }
];