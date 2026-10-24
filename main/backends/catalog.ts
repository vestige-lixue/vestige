import { type Backend } from "../../shared/backends";
import { executers, type Executer } from "../../shared/transcription/executer";
import { type DownloadPayload, type DownloadSource, type RuntimeDownload } from "../downloads/types";
import { cudaRuntimes } from "./runtimes";

export type BackendPackage = Backend & { repository: string; release: string; asset: string; license: boolean; estimatedBytes: number; runtimes: RuntimeDownload[] };
export type FetchRelease = (url: string, signal: AbortSignal) => Promise<unknown>;

// Compressed archive Content-Length, checked against the releases below on 2026-10-15.
// These offline display estimates are independent of the verified download lengths.
const archiveBytes: Record<string, number> = {
    "whisper-bin-x64.zip": 8_573_270,
    "whisper-cublas-11.8.0-bin-x64.zip": 272_982_859,
    "whisper-cublas-12.4.0-bin-x64.zip": 674_539_285,
    "whisper-bin-win-cpu-arm64.zip": 4_361_895,
    "whisper-bin-win-opencl-adreno-arm64.zip": 4_893_039,
    "whisper-bin-ubuntu-x64.tar.gz": 9_793_438,
    "whisper-bin-ubuntu-arm64.tar.gz": 4_605_905,
    "whisper-bin-macos-x64.tar.gz": 8_284_682,
    "whisper-bin-macos-arm64.tar.gz": 2_956_473,
    "sherpa-onnx-v1.13.8-win-x64-shared-MT-Release-no-tts.tar.bz2": 23_271_851,
    "sherpa-onnx-v1.13.8-win-arm64-shared-MT-Release.tar.bz2": 23_341_583,
    "sherpa-onnx-v1.13.8-linux-x64-shared-no-tts.tar.bz2": 24_802_494,
    "sherpa-onnx-v1.13.8-linux-aarch64-shared-cpu.tar.bz2": 28_091_778,
    "sherpa-onnx-v1.13.8-osx-x64-shared.tar.bz2": 22_846_038,
    "sherpa-onnx-v1.13.8-osx-arm64-shared.tar.bz2": 20_314_448,
    "sherpa-onnx-v1.13.8-cuda-12.x-cudnn-9.x-onnxruntime1.28.2-win-x64-cuda.tar.bz2": 595_017_373,
    "sherpa-onnx-v1.13.8-cuda-13.x-cudnn-9.x-onnxruntime1.28.2-win-x64-cuda.tar.bz2": 478_110_488,
    "sherpa-onnx-v1.13.8-cuda-12.x-cudnn-9.x-onnxruntime1.28.2-linux-x64-gpu.tar.bz2": 393_010_348,
    "sherpa-onnx-v1.13.8-cuda-13.x-cudnn-9.x-onnxruntime1.28.2-linux-x64-gpu.tar.bz2": 254_858_007
};

export function backendPackages(platform: NodeJS.Platform = process.platform, arch = process.arch): BackendPackage[] {
    if (!["win32", "linux", "darwin"].includes(platform) || !["x64", "arm64"].includes(arch)) return [];
    const suffix = platform === "win32" ? ".exe" : "";
    const packages: BackendPackage[] = [];
    const add = (id: string, name: string, executer: Executer, repository: string, release: string, asset: string, license = true): void => {
        let estimatedBytes = archiveBytes[asset];
        if (!estimatedBytes) throw new Error(`Missing backend download size: ${asset}`);
        const runtimes = id === "whisper-cuda-12" ? cudaRuntimes(12, platform, true)
            : id === "sherpa-cuda-12" ? cudaRuntimes(12, platform) : id === "sherpa-cuda-13" ? cudaRuntimes(13, platform) : [];
        estimatedBytes += runtimes.reduce((total, runtime) => total + runtime.file.size, 0);
        packages.push({ id, name, executer, repository, release, asset, license, estimatedBytes, runtimes, program: executers[executer].program + suffix });
    };
    const whisper = (id: string, name: string, asset: string): void => add(`whisper-${id}`, `whisper.cpp b5130 ${name}`, "whisper.cpp", "ggml-org/whisper.cpp", "b5130", asset);
    if (platform === "darwin") {
        add("whisper-metal-cpu", `whisper.cpp v1.9.5 ${arch === "arm64" ? "Metal / CPU" : "CPU"}`, "whisper.cpp", "vestige-lixue/macos-whisper-cli",
            "native-whisper-v1.9.5-d1be6fde11ac-582e5ae2afec", `whisper-bin-macos-${arch}.tar.gz`, false);
    }
    else if (platform === "win32") {
        whisper("cpu", "CPU", arch === "x64" ? "whisper-bin-x64.zip" : "whisper-bin-win-cpu-arm64.zip");
        if (arch === "x64") {
            whisper("cuda-11", "CUDA 11.8", "whisper-cublas-11.8.0-bin-x64.zip");
            whisper("cuda-12", "CUDA 12.8", "whisper-cublas-12.4.0-bin-x64.zip");
        }
        else whisper("opencl-adreno", "OpenCL Adreno", "whisper-bin-win-opencl-adreno-arm64.zip");
    }
    else whisper("cpu", "CPU", `whisper-bin-ubuntu-${arch}.tar.gz`);

    const sherpa = (id: string, name: string, target: string): void => add(`sherpa-${id}`, `sherpa-onnx v1.13.8 ${name}`, "sherpa-onnx", "k2-fsa/sherpa-onnx", "v1.13.8", `sherpa-onnx-v1.13.8-${target}.tar.bz2`);
    const cpu = platform === "win32" ? `win-${arch}-shared-MT-Release${arch === "x64" ? "-no-tts" : ""}`
        : platform === "darwin" ? `osx-${arch}-shared` : arch === "x64" ? "linux-x64-shared-no-tts" : "linux-aarch64-shared-cpu";
    sherpa("cpu", "CPU", cpu);
    if (arch === "x64" && platform !== "darwin") {
        for (const version of ["12", "13"]) {
            sherpa(`cuda-${version}`, `CUDA ${version} / cuDNN 9`, `cuda-${version}.x-cudnn-9.x-onnxruntime1.28.2-${platform === "win32" ? "win-x64-cuda" : "linux-x64-gpu"}`);
        }
    }
    return packages;
}

function archiveFiles(backend: BackendPackage): string[] {
    const files = [backend.program];
    if (backend.executer === "sherpa-onnx") files.push(`sherpa-onnx-vad${backend.program.endsWith(".exe") ? ".exe" : ""}`);
    // The CUDA 11 distribution already contains these runtime libraries.
    if (backend.id === "whisper-cuda-11") files.push("cublas64_11.dll", "cublasLt64_11.dll", "cudart64_110.dll");
    return files;
}

export async function resolveBackendDownload(backend: BackendPackage, fetchRelease: FetchRelease, signal: AbortSignal): Promise<DownloadPayload> {
    const value = await fetchRelease(`https://api.github.com/repos/${backend.repository}/releases/tags/${encodeURIComponent(backend.release)}`, signal);
    const release = value as { tag_name?: unknown; draft?: unknown; assets?: { name: string; browser_download_url: string; digest?: string; size: number; state: string }[] } | null;
    if (!release || release.draft || release.tag_name !== backend.release || !Array.isArray(release.assets)) throw new Error("Invalid backend release metadata.");
    const asset = release.assets.find(asset => asset.name === backend.asset && asset.state === "uploaded");
    if (!asset || !/^sha256:[a-f\d]{64}$/i.test(asset.digest ?? "") || !Number.isSafeInteger(asset.size) || asset.size <= 0
        || !asset.browser_download_url.startsWith(`https://github.com/${backend.repository}/releases/download/`)) {
        throw new Error(`No verified backend archive: ${backend.asset}`);
    }
    const files: DownloadPayload["files"] = [{ url: asset.browser_download_url, destination: backend.asset, size: asset.size, sha256: asset.digest!.slice(7) }];
    if (backend.license) files.push({ url: `https://raw.githubusercontent.com/${backend.repository}/${encodeURIComponent(backend.release)}/LICENSE`, destination: "licenses/LICENSE.txt" });
    // Whisper's CUDA 12.4 build uses the shared CUDA 12.8 runtime. Do not keep
    // the older bundled DLLs beside the executable, where they take precedence.
    const exclude = backend.id === "whisper-cuda-12" ? ["cublas64_12.dll", "cublasLt64_12.dll", "cudart64_12.dll", "nvblas64_12.dll", "nvrtc64_120_0.dll", "nvrtc-builtins64_124.dll"] : undefined;
    return {
        files,
        archive: { filename: backend.asset, programs: archiveFiles(backend), exclude },
        runtimes: backend.runtimes,
        notice: `${backend.name}\nExecuter: ${backend.executer}\nSource: https://github.com/${backend.repository}/releases/tag/${backend.release}\n${backend.runtimes.map(runtime => `Runtime: ${runtime.name}\nSource: ${runtime.file.url}\n`).join("")}Preserve the included licenses and distribution notices.`
    };
}

export function backendDownloads(fetchRelease: FetchRelease): DownloadSource[] {
    return backendPackages().map(backend => ({
        kind: "backend", id: backend.id, name: backend.name, estimatedBytes: backend.estimatedBytes,
        requiredFiles: [...archiveFiles(backend), ...backend.runtimes.flatMap(runtime => runtime.libraries)],
        resolve: signal => resolveBackendDownload(backend, fetchRelease, signal)
    }));
}