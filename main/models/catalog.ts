import { type Model } from "../../shared/models";
import { type DownloadPayload } from "../downloads/types";

export type DownloadConfiguration = Model & DownloadPayload & { estimatedBytes: number };

const whisperSource = "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1";
const paraformerSource = "https://huggingface.co/csukuangfj/sherpa-onnx-paraformer-zh-2024-03-09/resolve/906992d326ebf0c5171cde675aa0902be9e5bc6c";
const senseVoiceSource = "https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/2365baeacb507f821a0c8120fcee3d484dba7a07";
const fireRedSource = "https://huggingface.co/csukuangfj2/sherpa-onnx-fire-red-asr2-ctc-zh_en-int8-2026-02-25/resolve/423be1acfdc5d8aaa5a485fb6263fe4ea8570b06";
const qwenSources = [
    {
        variant: "0.6b", name: "0.6B",
        source: "https://huggingface.co/csukuangfj2/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25/resolve/68818b2313fe77bd06f6a7c5068ff3ef59d02b8a",
        modelPath: "",
        frontend: { size: 44_148_281, sha256: "d22dc4423e0940e49884e903d2ea2f7e5567c14fc1aed97e4e26d6b8f208ef9e" },
        encoder: { size: 182_491_662, sha256: "60748d3e6744a57c9c91e1b17424a6c2990567e8adceb0783940c03ed98fa9d9" },
        decoder: { size: 755_914_231, sha256: "4f6885be5959ae26af3089d38ee7972c5fafbeeb1cf8d5e76eab6d8b61ca5771" }
    },
    {
        variant: "1.7b", name: "1.7B",
        source: "https://modelscope.cn/models/zengshuishui/Qwen3-ASR-onnx/resolve/cb045ad80b8970c9d411d463e5b78991a566596c",
        modelPath: "model_1.7B/",
        frontend: { size: 48_080_441, sha256: "fa894a4ba53da6a4238f2a6ca0b09362e505d39cecbd646051b033e2e8d7e2fb" },
        encoder: { size: 314_222_162, sha256: "436fbd910a0c8914851e5ac1354e807be9f283d08a5da728adaa609731c41469" },
        decoder: { size: 2_037_458_645, sha256: "c43c853fa6e97d08365cb8a5502b360b595cd43c00dc60e4d8ca7cc18cad460b" }
    }
] as const;
const qwenTokenizer = [
    { name: "merges.txt", size: 1_671_853, sha256: "8831e4f1a044471340f7c0a83d7bd71306a5b867e95fd870f74d0c5308a904d5" },
    { name: "tokenizer_config.json", size: 12_487, sha256: "4942d005604266809309cabc9f4e9cb89ce855d59b14681fdc0e1cc62ea26c4c" },
    { name: "vocab.json", size: 2_776_833, sha256: "ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910" }
] as const;

// Download metadata, filename mappings and attribution belong here.
// Transfer lengths are obtained from the server at runtime.
// Display estimates use pinned revisions' file sizes; additions checked on 2026-10-21.
export const modelDownloads: DownloadConfiguration[] = [
    ...([
        ["tiny", "Tiny", 77_691_713],
        ["base", "Base", 147_951_465],
        ["small", "Small", 487_601_967],
        ["large-v3", "Large v3", 3_095_033_483],
        ["large-v3-turbo", "Large v3 Turbo", 1_624_555_275]
    ] as const).map(([variant, name, estimatedBytes]): DownloadConfiguration => ({
        id: `whisper-${variant}`,
        name: `Whisper ${name}`,
        estimatedBytes,
        executor: "whisper.cpp",
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
        executor: "sherpa-onnx",
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
    },
    {
        id: "sherpa-sense-voice-small-int8",
        name: "SenseVoiceSmall INT8",
        estimatedBytes: 239_233_841 + 315_894,
        executor: "sherpa-onnx",
        files: [
            {
                url: `${senseVoiceSource}/model.int8.onnx?download=true`, destination: "sense-voice-model.onnx",
                size: 239_233_841, sha256: "c71f0ce00bec95b07744e116345e33d8cbbe08cef896382cf907bf4b51a2cd51"
            },
            { url: `${senseVoiceSource}/tokens.txt?download=true`, destination: "tokens.txt", size: 315_894 },
            { url: "https://raw.githubusercontent.com/modelscope/FunASR/main/MODEL_LICENSE", destination: "LICENSE" },
            { url: `${senseVoiceSource}/LICENSE`, destination: "licenses/ONNX-LICENSE" }
        ],
        notice: [
            "SenseVoiceSmall INT8", "Model authors: Alibaba Group / FunAudioLLM / SenseVoice contributors",
            "License: FunASR Model Open Source License Agreement (model weights)",
            "Original model: https://huggingface.co/FunAudioLLM/SenseVoiceSmall",
            "Model license: https://github.com/modelscope/FunASR/blob/main/MODEL_LICENSE",
            "ONNX conversion and distribution: Fangjun Kuang (csukuangfj) / sherpa-onnx",
            senseVoiceSource.replace("/resolve/", "/tree/"),
            "Vestige filename mapping: model.int8.onnx -> sense-voice-model.onnx (contents unchanged); tokens.txt unchanged."
        ].join("\n")
    },
    {
        id: "sherpa-fire-red-asr2-ctc-int8",
        name: "FireRedASR2-CTC INT8",
        estimatedBytes: 775_861_420 + 79_172,
        executor: "sherpa-onnx",
        files: [
            {
                url: `${fireRedSource}/model.int8.onnx?download=true`, destination: "fire-red-asr-ctc.onnx",
                size: 775_861_420, sha256: "ca3dbabd82170110cc0b343c2890866d449984bc9cd92b9a18371ff80a81bb99"
            },
            { url: `${fireRedSource}/tokens.txt?download=true`, destination: "tokens.txt", size: 79_172 },
            { url: "https://www.apache.org/licenses/LICENSE-2.0.txt", destination: "LICENSE" }
        ],
        notice: [
            "FireRedASR2-CTC INT8", "Model authors: FireRedTeam", "License: Apache License 2.0",
            "Original model: https://huggingface.co/FireRedTeam/FireRedASR2-AED",
            "This ONNX export contains the CTC branch only; the attention decoder is excluded.",
            "ONNX conversion and distribution: Fangjun Kuang (csukuangfj2) / sherpa-onnx",
            fireRedSource.replace("/resolve/", "/tree/"),
            "Vestige filename mapping: model.int8.onnx -> fire-red-asr-ctc.onnx (contents unchanged); tokens.txt unchanged."
        ].join("\n")
    },
    ...qwenSources.map(({ variant, name, source, modelPath, frontend, encoder, decoder }): DownloadConfiguration => ({
        id: `sherpa-qwen3-asr-${variant}-int8`,
        name: `Qwen3-ASR ${name} INT8`,
        estimatedBytes: frontend.size + encoder.size + decoder.size + qwenTokenizer.reduce((sum, file) => sum + file.size, 0),
        executor: "sherpa-onnx",
        files: [
            { url: `${source}/${modelPath}conv_frontend.onnx`, destination: "qwen3-asr-conv-frontend.onnx", ...frontend },
            { url: `${source}/${modelPath}encoder.int8.onnx`, destination: "qwen3-asr-encoder.onnx", ...encoder },
            { url: `${source}/${modelPath}decoder.int8.onnx`, destination: "qwen3-asr-decoder.onnx", ...decoder },
            ...qwenTokenizer.map(({ name: filename, size, sha256 }) => ({
                url: `${source}/tokenizer/${filename}`, destination: `qwen3-asr-tokenizer/${filename}`, size, sha256
            })),
            { url: "https://www.apache.org/licenses/LICENSE-2.0.txt", destination: "LICENSE" }
        ],
        notice: [
            `Qwen3-ASR ${name} INT8`, "Model authors: Qwen Team / Alibaba Cloud", "License: Apache License 2.0",
            `Original model: https://huggingface.co/Qwen/Qwen3-ASR-${name}`,
            "ONNX export: Wasser1462 / zengshuishui; sherpa-onnx integration and distribution: Fangjun Kuang / k2-fsa",
            "https://github.com/Wasser1462/Qwen3-ASR-onnx",
            source.replace("/resolve/", "/tree/"),
            "Vestige filename mapping: conv_frontend.onnx -> qwen3-asr-conv-frontend.onnx; encoder.int8.onnx -> qwen3-asr-encoder.onnx; decoder.int8.onnx -> qwen3-asr-decoder.onnx; tokenizer/ -> qwen3-asr-tokenizer/ (contents unchanged)."
        ].join("\n")
    }))
];