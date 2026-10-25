# Bundled resources

Prepare FFmpeg / ffprobe, aria2 and the Silero VAD model for the release target before packaging. Transcription backends are downloaded in the app through Transcription backends, just like speech recognition models; they are not included in the application package. The downloader uses the project's Node.js runtime and system `tar` (Windows includes it). On Unix, extracting a ZIP also requires `unzip`.

From the repository root:

```sh
node resources/bin/download.mjs --dry-run
node resources/bin/download.mjs
```

`--dry-run` resolves release metadata and prints the selected files without downloading resources or changing local files. `--platform win32|linux|darwin` and `--arch x64|arm64` select a packaging target; defaults come from Node.js. `GITHUB_TOKEN` is optional for GitHub API rate limits.

Use `--only ffmpeg`, `--only aria2` or `--only vad` to select one package. For example, `node resources/bin/download.mjs --only ffmpeg` installs both `ffmpeg` and `ffprobe` with their matching shared libraries. `ffprobe` is a separate executable required for importing media. VAD uses the same ONNX model on every supported platform and architecture.

An ordinary run downloads all three packages into a temporary directory, checks every downloaded file against its size and SHA-256 digest, and retains the required CLI programs, shared libraries, VAD model and distribution notices. After all selected packages are ready, it replaces their directories. Close Vestige before updating, because running processes may lock old binaries. The downloader does not compile source or download speech recognition models.

When the target matches the current platform and architecture, the downloader also runs `ffmpeg -version`, `ffprobe -version` and `aria2c --version` before replacing existing files. A startup failure leaves the installed programs intact.

The resulting layout is:

```text
resources/bin/
  aria2/aria2c[.exe]
  ffmpeg/ffmpeg[.exe]
  ffmpeg/ffprobe[.exe]
  vad/silero_vad.onnx
  vad/LICENSE
  vad/README.md
```

Program directories also hold their shared libraries and `licenses/`. Each package directory holds a `download.json` recording the resolved release and an `assets` array with each file's URL and digest. Downloaded programs, the VAD model and generated metadata are local packaging inputs ignored by Git; the downloader, documentation and VAD license remain tracked. VAD downloads preserve its tracked `README.md` and `LICENSE`.

## Upstream sources and supported targets

- **aria2:** the official [1.37.0 Windows x64 archive](https://github.com/aria2/aria2/releases/tag/release-1.37.0), pinned to the SHA-256 in [Microsoft's winget manifest](https://github.com/microsoft/winget-pkgs/blob/master/manifests/a/aria2/aria2/1.37.0/aria2.aria2.installer.yaml). This older release has no GitHub asset digest. Other targets require a matching `aria2c` executable, its libraries and distribution notices supplied in `resources/bin/aria2`; prepare FFmpeg with `--only ffmpeg` and VAD with `--only vad`. Development also searches PATH for `aria2c`. Backend and model downloads require an aria2 build with HTTPS, GZip and JSON-RPC support.
- **FFmpeg and ffprobe:** Windows and Linux use [BtbN's latest shared LGPL builds](https://github.com/BtbN/FFmpeg-Builds/releases/latest), linked by the [FFmpeg download page](https://ffmpeg.org/download.html). The downloader keeps selecting BtbN's latest automatic FFmpeg master build. macOS uses the latest [ffmpeg-static release](https://github.com/eugeneware/ffmpeg-static/releases), downloading `ffmpeg-darwin-<arch>`, `ffprobe-darwin-<arch>` and that architecture's LICENSE and README assets individually. Its release tag does not necessarily describe every included binary's FFmpeg version; these builds also have their own codec and license configuration.
- **Silero VAD:** the official unquantized v6.2 ONNX model, pinned to its size and SHA-256 digest. See [VAD documentation](vad/README.md) for the source, license and segmentation behavior.

FFmpeg packages cover Windows, Linux and macOS, each on x64/arm64; aria2's automated preparation currently covers Windows x64. VAD supports all of these targets. Unsupported targets and missing release assets fail before replacing any packages.

Electron Builder copies the `ffmpeg/`, `aria2/` and `vad/` directories to `process.resourcesPath/bin`, outside the application's ASAR archive. Old local Whisper or Sherpa directories are excluded from packaging and are not used as fallback backends.

Downloaded transcription backends and models stay in the user's `backends` and `models` directories. Backend packages, including the independently built [macOS Whisper CLI](https://github.com/vestige-lixue/macos-whisper-cli), are configured in [the application catalog](../../main/backends/catalog.ts). Choose a backend folder explicitly before starting transcription. Each transcription gets a temporary working directory and a directory link to its selected model, so model files do not need to be copied.

CUDA backends must work without a system CUDA Toolkit or cuDNN installation. Sherpa CUDA 12/13 downloads include the matching NVIDIA runtime components pinned in [the runtime catalog](../../main/backends/runtimes.ts). These are NVIDIA's runtime wheels, extracted as ZIP archives without Python. Only the required shared libraries and licenses are retained. A compatible NVIDIA graphics driver is still required. Every Sherpa package also retains the official standalone VAD executable.

Whisper CUDA 11 keeps its bundled runtime. Whisper's CUDA 12.4 build is distributed with the same CUDA 12.8 cuBLAS and CUDA Runtime components as Sherpa CUDA 12; it does not need cuDNN. Verified components are cached under `runtimes/<archive-sha256>` in the user data directory, next to `backends`, and hard-linked into backend directories, with copying as a fallback when hard links are unavailable. At startup, cached components no longer linked from any backend are removed, so deleting a backend folder also releases its runtimes. CUDA major versions and different cuDNN builds stay separate. Download estimates include the runtime archives before cache reuse; the upstream Whisper archive still contains its old DLLs, which are excluded during installation. An existing managed Sherpa package with missing runtime libraries can be completed without downloading its backend archive again; conflicting local files are never overwritten.