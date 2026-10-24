import { type RuntimeDownload } from "../downloads/types";

// NVIDIA runtime wheels are ZIP archives; no Python installation is used.
// Pinned from https://pypi.org/pypi/<package>/<version>/json on 2026-10-22.
// ONNX Runtime 1.28.2 requires CUDA 12.8+ or CUDA 13, with cuDNN 9.
const packages: Record<string, RuntimeDownload> = {
    "nvidia-cuda-runtime-cu12-linux": {
        name: "nvidia-cuda-runtime-cu12 12.8.90",
        file: {
            url: "https://files.pythonhosted.org/packages/0d/9b/a997b638fcd068ad6e4d53b8551a7d30fe8b404d6f1804abf1df69838932/nvidia_cuda_runtime_cu12-12.8.90-py3-none-manylinux2014_x86_64.manylinux_2_17_x86_64.whl",
            destination: "nvidia_cuda_runtime_cu12-12.8.90-py3-none-manylinux2014_x86_64.manylinux_2_17_x86_64.whl",
            size: 954765,
            sha256: "adade8dcbd0edf427b7204d480d6066d33902cab2a4707dcfc48a2d0fd44ab90"
        },
        libraries: ["libcudart.so.12"]
    },
    "nvidia-cuda-runtime-cu12-win32": {
        name: "nvidia-cuda-runtime-cu12 12.8.90",
        file: {
            url: "https://files.pythonhosted.org/packages/30/a5/a515b7600ad361ea14bfa13fb4d6687abf500adc270f19e89849c0590492/nvidia_cuda_runtime_cu12-12.8.90-py3-none-win_amd64.whl",
            destination: "nvidia_cuda_runtime_cu12-12.8.90-py3-none-win_amd64.whl",
            size: 944318,
            sha256: "c0c6027f01505bfed6c3b21ec546f69c687689aad5f1a377554bc6ca4aa993a8"
        },
        libraries: ["cudart64_12.dll"]
    },
    "nvidia-cublas-cu12-linux": {
        name: "nvidia-cublas-cu12 12.8.4.1",
        file: {
            url: "https://files.pythonhosted.org/packages/dc/61/e24b560ab2e2eaeb3c839129175fb330dfcfc29e5203196e5541a4c44682/nvidia_cublas_cu12-12.8.4.1-py3-none-manylinux_2_27_x86_64.whl",
            destination: "nvidia_cublas_cu12-12.8.4.1-py3-none-manylinux_2_27_x86_64.whl",
            size: 594346921,
            sha256: "8ac4e771d5a348c551b2a426eda6193c19aa630236b418086020df5ba9667142"
        },
        libraries: ["libcublas.so.12", "libcublasLt.so.12"]
    },
    "nvidia-cublas-cu12-win32": {
        name: "nvidia-cublas-cu12 12.8.4.1",
        file: {
            url: "https://files.pythonhosted.org/packages/70/61/7d7b3c70186fb651d0fbd35b01dbfc8e755f69fd58f817f3d0f642df20c3/nvidia_cublas_cu12-12.8.4.1-py3-none-win_amd64.whl",
            destination: "nvidia_cublas_cu12-12.8.4.1-py3-none-win_amd64.whl",
            size: 567544208,
            sha256: "47e9b82132fa8d2b4944e708049229601448aaad7e6f296f630f2d1a32de35af"
        },
        libraries: ["cublas64_12.dll", "cublasLt64_12.dll"]
    },
    "nvidia-cufft-cu12-linux": {
        name: "nvidia-cufft-cu12 11.3.3.83",
        file: {
            url: "https://files.pythonhosted.org/packages/1f/13/ee4e00f30e676b66ae65b4f08cb5bcbb8392c03f54f2d5413ea99a5d1c80/nvidia_cufft_cu12-11.3.3.83-py3-none-manylinux2014_x86_64.manylinux_2_17_x86_64.whl",
            destination: "nvidia_cufft_cu12-11.3.3.83-py3-none-manylinux2014_x86_64.manylinux_2_17_x86_64.whl",
            size: 193118695,
            sha256: "4d2dd21ec0b88cf61b62e6b43564355e5222e4a3fb394cac0db101f2dd0d4f74"
        },
        libraries: ["libcufft.so.11"]
    },
    "nvidia-cufft-cu12-win32": {
        name: "nvidia-cufft-cu12 11.3.3.83",
        file: {
            url: "https://files.pythonhosted.org/packages/7d/ec/ce1629f1e478bb5ccd208986b5f9e0316a78538dd6ab1d0484f012f8e2a1/nvidia_cufft_cu12-11.3.3.83-py3-none-win_amd64.whl",
            destination: "nvidia_cufft_cu12-11.3.3.83-py3-none-win_amd64.whl",
            size: 192216559,
            sha256: "7a64a98ef2a7c47f905aaf8931b69a3a43f27c55530c698bb2ed7c75c0b42cb7"
        },
        libraries: ["cufft64_11.dll"]
    },
    "nvidia-curand-cu12-linux": {
        name: "nvidia-curand-cu12 10.3.9.90",
        file: {
            url: "https://files.pythonhosted.org/packages/fb/aa/6584b56dc84ebe9cf93226a5cde4d99080c8e90ab40f0c27bda7a0f29aa1/nvidia_curand_cu12-10.3.9.90-py3-none-manylinux_2_27_x86_64.whl",
            destination: "nvidia_curand_cu12-10.3.9.90-py3-none-manylinux_2_27_x86_64.whl",
            size: 63619976,
            sha256: "b32331d4f4df5d6eefa0554c565b626c7216f87a06a4f56fab27c3b68a830ec9"
        },
        libraries: ["libcurand.so.10"]
    },
    "nvidia-curand-cu12-win32": {
        name: "nvidia-curand-cu12 10.3.9.90",
        file: {
            url: "https://files.pythonhosted.org/packages/b9/75/70c05b2f3ed5be3bb30b7102b6eb78e100da4bbf6944fd6725c012831cab/nvidia_curand_cu12-10.3.9.90-py3-none-win_amd64.whl",
            destination: "nvidia_curand_cu12-10.3.9.90-py3-none-win_amd64.whl",
            size: 62765309,
            sha256: "f149a8ca457277da854f89cf282d6ef43176861926c7ac85b2a0fbd237c587ec"
        },
        libraries: ["curand64_10.dll"]
    },
    "nvidia-cuda-nvrtc-cu12-linux": {
        name: "nvidia-cuda-nvrtc-cu12 12.8.93",
        file: {
            url: "https://files.pythonhosted.org/packages/05/6b/32f747947df2da6994e999492ab306a903659555dddc0fbdeb9d71f75e52/nvidia_cuda_nvrtc_cu12-12.8.93-py3-none-manylinux2010_x86_64.manylinux_2_12_x86_64.whl",
            destination: "nvidia_cuda_nvrtc_cu12-12.8.93-py3-none-manylinux2010_x86_64.manylinux_2_12_x86_64.whl",
            size: 88040029,
            sha256: "a7756528852ef889772a84c6cd89d41dfa74667e24cca16bb31f8f061e3e9994"
        },
        libraries: ["libnvrtc-builtins.so.12.8", "libnvrtc.so.12"]
    },
    "nvidia-cuda-nvrtc-cu12-win32": {
        name: "nvidia-cuda-nvrtc-cu12 12.8.93",
        file: {
            url: "https://files.pythonhosted.org/packages/45/51/52a3d84baa2136cc8df15500ad731d74d3a1114d4c123e043cb608d4a32b/nvidia_cuda_nvrtc_cu12-12.8.93-py3-none-win_amd64.whl",
            destination: "nvidia_cuda_nvrtc_cu12-12.8.93-py3-none-win_amd64.whl",
            size: 73586838,
            sha256: "7a4b6b2904850fe78e0bd179c4b655c404d4bb799ef03ddc60804247099ae909"
        },
        libraries: ["nvrtc-builtins64_128.dll", "nvrtc64_120_0.dll"]
    },
    "nvidia-nvjitlink-cu12-linux": {
        name: "nvidia-nvjitlink-cu12 12.8.93",
        file: {
            url: "https://files.pythonhosted.org/packages/f6/74/86a07f1d0f42998ca31312f998bd3b9a7eff7f52378f4f270c8679c77fb9/nvidia_nvjitlink_cu12-12.8.93-py3-none-manylinux2010_x86_64.manylinux_2_12_x86_64.whl",
            destination: "nvidia_nvjitlink_cu12-12.8.93-py3-none-manylinux2010_x86_64.manylinux_2_12_x86_64.whl",
            size: 39254836,
            sha256: "81ff63371a7ebd6e6451970684f916be2eab07321b73c9d244dc2b4da7f73b88"
        },
        libraries: ["libnvJitLink.so.12"]
    },
    "nvidia-nvjitlink-cu12-win32": {
        name: "nvidia-nvjitlink-cu12 12.8.93",
        file: {
            url: "https://files.pythonhosted.org/packages/ed/d7/34f02dad2e30c31b10a51f6b04e025e5dd60e5f936af9045a9b858a05383/nvidia_nvjitlink_cu12-12.8.93-py3-none-win_amd64.whl",
            destination: "nvidia_nvjitlink_cu12-12.8.93-py3-none-win_amd64.whl",
            size: 268553710,
            sha256: "bd93fbeeee850917903583587f4fc3a4eafa022e34572251368238ab5e6bd67f"
        },
        libraries: ["nvJitLink_120_0.dll"]
    },
    "nvidia-cudnn-cu12-linux": {
        name: "nvidia-cudnn-cu12 9.12.0.46",
        file: {
            url: "https://files.pythonhosted.org/packages/de/14/9288024887ba320eb4e51d01cf37aab11d38f774016bcc0dedac0948d0bc/nvidia_cudnn_cu12-9.12.0.46-py3-none-manylinux_2_27_x86_64.whl",
            destination: "nvidia_cudnn_cu12-9.12.0.46-py3-none-manylinux_2_27_x86_64.whl",
            size: 571674872,
            sha256: "73471a185656232b383693294431882edb14584ee47f41c0abd81556b92ef2ac"
        },
        libraries: ["libcudnn.so.9", "libcudnn_adv.so.9", "libcudnn_cnn.so.9", "libcudnn_engines_precompiled.so.9", "libcudnn_engines_runtime_compiled.so.9", "libcudnn_graph.so.9", "libcudnn_heuristic.so.9", "libcudnn_ops.so.9"]
    },
    "nvidia-cudnn-cu12-win32": {
        name: "nvidia-cudnn-cu12 9.12.0.46",
        file: {
            url: "https://files.pythonhosted.org/packages/07/e4/7c76ba45ed0e801a2143758601fa1a938e26e1a38c8cd34a5f63783583fa/nvidia_cudnn_cu12-9.12.0.46-py3-none-win_amd64.whl",
            destination: "nvidia_cudnn_cu12-9.12.0.46-py3-none-win_amd64.whl",
            size: 558204796,
            sha256: "723195f8dc6280643a1438f2a22f7bf16f56b8cc4a497ff71d0872b9e9460206"
        },
        libraries: ["cudnn64_9.dll", "cudnn_adv64_9.dll", "cudnn_cnn64_9.dll", "cudnn_engines_precompiled64_9.dll", "cudnn_engines_runtime_compiled64_9.dll", "cudnn_graph64_9.dll", "cudnn_heuristic64_9.dll", "cudnn_ops64_9.dll"]
    },
    "nvidia-cuda-runtime-linux": {
        name: "nvidia-cuda-runtime 13.0.96",
        file: {
            url: "https://files.pythonhosted.org/packages/2e/24/d1558f3b68b1d26e706813b1d10aa1d785e4698c425af8db8edc3dced472/nvidia_cuda_runtime-13.0.96-py3-none-manylinux2014_x86_64.manylinux_2_17_x86_64.whl",
            destination: "nvidia_cuda_runtime-13.0.96-py3-none-manylinux2014_x86_64.manylinux_2_17_x86_64.whl",
            size: 2243632,
            sha256: "7f82250d7782aa23b6cfe765ecc7db554bd3c2870c43f3d1821f1d18aebf0548"
        },
        libraries: ["libcudart.so.13"]
    },
    "nvidia-cuda-runtime-win32": {
        name: "nvidia-cuda-runtime 13.0.96",
        file: {
            url: "https://files.pythonhosted.org/packages/b7/94/6b867483bec07da24ffa32736c79fabb94ef3a7af4d787a9d4a974868576/nvidia_cuda_runtime-13.0.96-py3-none-win_amd64.whl",
            destination: "nvidia_cuda_runtime-13.0.96-py3-none-win_amd64.whl",
            size: 2927037,
            sha256: "f79298c8a098cec150a597c8eba58ecdab96e3bdc4b9bc4f9983635031740492"
        },
        libraries: ["cudart64_13.dll"]
    },
    "nvidia-cublas-linux": {
        name: "nvidia-cublas 13.1.0.3",
        file: {
            url: "https://files.pythonhosted.org/packages/e7/44/423ac00af4dd95a5aeb27207e2c0d9b7118702149bf4704c3ddb55bb7429/nvidia_cublas-13.1.0.3-py3-none-manylinux_2_27_x86_64.whl",
            destination: "nvidia_cublas-13.1.0.3-py3-none-manylinux_2_27_x86_64.whl",
            size: 423133236,
            sha256: "ee8722c1f0145ab246bccb9e452153b5e0515fd094c3678df50b2a0888b8b171"
        },
        libraries: ["libcublas.so.13", "libcublasLt.so.13"]
    },
    "nvidia-cublas-win32": {
        name: "nvidia-cublas 13.1.0.3",
        file: {
            url: "https://files.pythonhosted.org/packages/10/f5/f50bc3f5c2bb57ab8f5b4d78bc1146b57810d42cb8fcb28cbe2e14050376/nvidia_cublas-13.1.0.3-py3-none-win_amd64.whl",
            destination: "nvidia_cublas-13.1.0.3-py3-none-win_amd64.whl",
            size: 404355960,
            sha256: "2a3b94a37def342471c59fad7856caee4926809a72dd5270155d6a31b5b277be"
        },
        libraries: ["cublas64_13.dll", "cublasLt64_13.dll"]
    },
    "nvidia-cufft-linux": {
        name: "nvidia-cufft 12.0.0.61",
        file: {
            url: "https://files.pythonhosted.org/packages/a8/2f/7b57e29836ea8714f81e9898409196f47d772d5ddedddf1592eadb8ab743/nvidia_cufft-12.0.0.61-py3-none-manylinux2014_x86_64.manylinux_2_17_x86_64.whl",
            destination: "nvidia_cufft-12.0.0.61-py3-none-manylinux2014_x86_64.manylinux_2_17_x86_64.whl",
            size: 214085489,
            sha256: "6c44f692dce8fd5ffd3e3df134b6cdb9c2f72d99cf40b62c32dde45eea9ddad3"
        },
        libraries: ["libcufft.so.12"]
    },
    "nvidia-cufft-win32": {
        name: "nvidia-cufft 12.0.0.61",
        file: {
            url: "https://files.pythonhosted.org/packages/85/b2/f8af21a2ed1beed337a6a02c5a28aeb85441f4d578ec3d529543c775ea4b/nvidia_cufft-12.0.0.61-py3-none-win_amd64.whl",
            destination: "nvidia_cufft-12.0.0.61-py3-none-win_amd64.whl",
            size: 213342123,
            sha256: "2abce5b39d2f5ae12730fb7e5db6696533e36c26e2d3e8fd1750bdd2853364eb"
        },
        libraries: ["cufft64_12.dll"]
    },
    "nvidia-curand-linux": {
        name: "nvidia-curand 10.4.0.35",
        file: {
            url: "https://files.pythonhosted.org/packages/a5/9f/be0a41ca4a4917abf5cb9ae0daff1a6060cc5de950aec0396de9f3b52bc5/nvidia_curand-10.4.0.35-py3-none-manylinux_2_27_x86_64.whl",
            destination: "nvidia_curand-10.4.0.35-py3-none-manylinux_2_27_x86_64.whl",
            size: 59544258,
            sha256: "1aee33a5da6e1db083fe2b90082def8915f30f3248d5896bcec36a579d941bfc"
        },
        libraries: ["libcurand.so.10"]
    },
    "nvidia-curand-win32": {
        name: "nvidia-curand 10.4.0.35",
        file: {
            url: "https://files.pythonhosted.org/packages/99/27/72103153b1ffc00e09fdc40ac970235343dcd1ea8bd762e84d2d73219ffa/nvidia_curand-10.4.0.35-py3-none-win_amd64.whl",
            destination: "nvidia_curand-10.4.0.35-py3-none-win_amd64.whl",
            size: 55242481,
            sha256: "65b1710aa6961d326b411e314b374290904c5ddf41dc3f766ebc3f1d7d4ca69f"
        },
        libraries: ["curand64_10.dll"]
    },
    "nvidia-cuda-nvrtc-linux": {
        name: "nvidia-cuda-nvrtc 13.0.88",
        file: {
            url: "https://files.pythonhosted.org/packages/c3/68/483a78f5e8f31b08fb1bb671559968c0ca3a065ac7acabfc7cee55214fd6/nvidia_cuda_nvrtc-13.0.88-py3-none-manylinux2010_x86_64.manylinux_2_12_x86_64.whl",
            destination: "nvidia_cuda_nvrtc-13.0.88-py3-none-manylinux2010_x86_64.manylinux_2_12_x86_64.whl",
            size: 90215200,
            sha256: "ad9b6d2ead2435f11cbb6868809d2adeeee302e9bb94bcf0539c7a40d80e8575"
        },
        libraries: ["libnvrtc-builtins.so.13.0", "libnvrtc.so.13"]
    },
    "nvidia-cuda-nvrtc-win32": {
        name: "nvidia-cuda-nvrtc 13.0.88",
        file: {
            url: "https://files.pythonhosted.org/packages/4a/af/345fedb9f4c76c84ab4fa445b36bd4048a4d9db60e6bc76b4f913ff4b852/nvidia_cuda_nvrtc-13.0.88-py3-none-win_amd64.whl",
            destination: "nvidia_cuda_nvrtc-13.0.88-py3-none-win_amd64.whl",
            size: 76807835,
            sha256: "6bcd4e7f8e205cbe644f5a98f2f799bef9556fefc89dd786e79a16312ce49872"
        },
        libraries: ["nvrtc-builtins64_130.dll", "nvrtc64_130_0.dll"]
    },
    "nvidia-nvjitlink-linux": {
        name: "nvidia-nvjitlink 13.0.88",
        file: {
            url: "https://files.pythonhosted.org/packages/56/7a/123e033aaff487c77107195fa5a2b8686795ca537935a24efae476c41f05/nvidia_nvjitlink-13.0.88-py3-none-manylinux2010_x86_64.manylinux_2_12_x86_64.whl",
            destination: "nvidia_nvjitlink-13.0.88-py3-none-manylinux2010_x86_64.manylinux_2_12_x86_64.whl",
            size: 40713933,
            sha256: "13a74f429e23b921c1109976abefacc69835f2f433ebd323d3946e11d804e47b"
        },
        libraries: ["libnvJitLink.so.13"]
    },
    "nvidia-nvjitlink-win32": {
        name: "nvidia-nvjitlink 13.0.88",
        file: {
            url: "https://files.pythonhosted.org/packages/e4/01/07530b0e37546231052e30234540289c42eaffa486f1a34a87fed340157b/nvidia_nvjitlink-13.0.88-py3-none-win_amd64.whl",
            destination: "nvidia_nvjitlink-13.0.88-py3-none-win_amd64.whl",
            size: 36035115,
            sha256: "634e96e3da9ef845ae744097a1f289238ecf946ce0b82e93cdce14b9782e682f"
        },
        libraries: ["nvJitLink_130_0.dll"]
    },
    "nvidia-cudnn-cu13-linux": {
        name: "nvidia-cudnn-cu13 9.12.0.46",
        file: {
            url: "https://files.pythonhosted.org/packages/83/ad/beb3ff8ccceb39270008c22e98e7d6a5f9c859d0fc7c4f202979139c3016/nvidia_cudnn_cu13-9.12.0.46-py3-none-manylinux_2_27_x86_64.whl",
            destination: "nvidia_cudnn_cu13-9.12.0.46-py3-none-manylinux_2_27_x86_64.whl",
            size: 313738868,
            sha256: "f3befad533e234069eb61ae0d12cb7aa8af0ccf36f28c1d4273cc0005d990de0"
        },
        libraries: ["libcudnn.so.9", "libcudnn_adv.so.9", "libcudnn_cnn.so.9", "libcudnn_engines_precompiled.so.9", "libcudnn_engines_runtime_compiled.so.9", "libcudnn_graph.so.9", "libcudnn_heuristic.so.9", "libcudnn_ops.so.9"]
    },
    "nvidia-cudnn-cu13-win32": {
        name: "nvidia-cudnn-cu13 9.12.0.46",
        file: {
            url: "https://files.pythonhosted.org/packages/89/c0/1a708085f2bd6e2def5f87c91b8bdb801dec6c4d4c5c1951a8fc31854164/nvidia_cudnn_cu13-9.12.0.46-py3-none-win_amd64.whl",
            destination: "nvidia_cudnn_cu13-9.12.0.46-py3-none-win_amd64.whl",
            size: 303914745,
            sha256: "171f7a41a9ddff4a82b158b44daa003701b9681f202b0e57c2d8fd47e13b0de3"
        },
        libraries: ["cudnn64_9.dll", "cudnn_adv64_9.dll", "cudnn_cnn64_9.dll", "cudnn_engines_precompiled64_9.dll", "cudnn_engines_runtime_compiled64_9.dll", "cudnn_graph64_9.dll", "cudnn_heuristic64_9.dll", "cudnn_ops64_9.dll"]
    }
};

export function cudaRuntimes(major: 12 | 13, platform: NodeJS.Platform, whisper = false): RuntimeDownload[] {
    if (platform !== "win32" && platform !== "linux") throw new Error("Unsupported CUDA platform.");
    const suffix = major === 12 ? "-cu12" : "";
    const names = ["cuda-runtime", "cublas"];
    if (!whisper) names.push("cufft", "curand", "cuda-nvrtc", "nvjitlink");
    const selected = names.map(name => packages[`nvidia-${name}${suffix}-${platform}`]);
    if (!whisper) selected.push(packages[`nvidia-cudnn-cu${major}-${platform}`]);
    return selected;
}