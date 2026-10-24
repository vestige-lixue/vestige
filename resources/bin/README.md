# Native programs

Prepare FFmpeg / ffprobe and aria2 for the release target before packaging. Transcription backends are downloaded in the app through Transcription backends, just like models; they are not included in the application package. The downloader uses the project's Node.js runtime and system `tar` (Windows includes it). On Unix, extracting a ZIP also requires `unzip`.

From the repository root:

```sh
node resources/bin/download.mjs --dry-run
node resources/bin/download.mjs
```

`--dry-run` reads release metadata and prints the selected files without downloading programs or changing local files. `--platform win32|linux|darwin` and `--arch x64|arm64` select a packaging target; defaults come from Node.js. `GITHUB_TOKEN` is optional for GitHub API rate limits.

Use `--only ffmpeg` or `--only aria2` to select one package. For example, `node resources/bin/download.mjs --only ffmpeg` installs both `ffmpeg` and `ffprobe` with their matching shared libraries. `ffprobe` is a separate executable required for importing media.

An ordinary run downloads both packages into a temporary directory, checks every downloaded file against its SHA-256 digest, and retains the required CLI programs, shared libraries and distribution notices. After all selected packages are ready, it replaces their program directories. Close Vestige before updating, because running processes may lock old binaries. The downloader neither compiles source nor downloads models.

When the target matches the current platform and architecture, the downloader also runs `ffmpeg -version`, `ffprobe -version` and `aria2c --version` before replacing existing files. A startup failure leaves the installed programs intact.

The resulting layout is:

```text
resources/bin/
  aria2/aria2c[.exe]
  ffmpeg/ffmpeg[.exe]
  ffmpeg/ffprobe[.exe]
```

Each directory also holds its shared libraries, `licenses/` and a `download.json` recording the resolved release and an `assets` array with each file's URL and digest. Generated programs are local packaging inputs ignored by Git; the downloader and this document remain tracked.

## Upstream sources and supported targets

- **aria2:** the official [1.37.0 Windows x64 archive](https://github.com/aria2/aria2/releases/tag/release-1.37.0), pinned to the SHA-256 in [Microsoft's winget manifest](https://github.com/microsoft/winget-pkgs/blob/master/manifests/a/aria2/aria2/1.37.0/aria2.aria2.installer.yaml). This older release has no GitHub asset digest. Other targets require a matching `aria2c` executable, its libraries and distribution notices supplied in `resources/bin/aria2`; prepare FFmpeg with `--only ffmpeg`. Development also searches PATH for `aria2c`. Backend and model downloads require an aria2 build with HTTPS, GZip and JSON-RPC support.
- **FFmpeg and ffprobe:** Windows and Linux use [BtbN's latest shared LGPL builds](https://github.com/BtbN/FFmpeg-Builds/releases/latest), linked by the [FFmpeg download page](https://ffmpeg.org/download.html). The downloader keeps selecting BtbN's latest automatic FFmpeg master build. macOS uses the latest [ffmpeg-static release](https://github.com/eugeneware/ffmpeg-static/releases), downloading `ffmpeg-darwin-<arch>`, `ffprobe-darwin-<arch>` and that architecture's LICENSE and README assets individually. Its release tag does not necessarily describe every included binary's FFmpeg version; these builds also have their own codec and license configuration.

FFmpeg packages cover Windows, Linux and macOS, each on x64/arm64; aria2's automated preparation currently covers Windows x64. Unsupported targets and missing release assets fail before replacing any programs.

Electron Builder copies only the `ffmpeg/` and `aria2/` directories to `process.resourcesPath/bin`, outside the application's ASAR archive. Old local Whisper or Sherpa directories are excluded from packaging and are not used as fallback backends.

Downloaded transcription backends and models stay in the user's `backends` and `models` directories. Backend packages, including the independently built [macOS Whisper CLI](https://github.com/vestige-lixue/macos-whisper-cli), are configured in [the application catalog](../../main/backends/catalog.ts). Choose a backend folder explicitly before starting transcription. Each transcription gets a temporary working directory and a directory link to its selected model, so model files do not need to be copied.

CUDA backends must work without a system CUDA Toolkit or cuDNN installation. Sherpa CUDA 12/13 downloads include the matching NVIDIA runtime components pinned in [the runtime catalog](../../main/backends/runtimes.ts). These are NVIDIA's runtime wheels, extracted as ZIP archives without Python. Only the required shared libraries and licenses are retained. A compatible NVIDIA graphics driver is still required. Every Sherpa package also retains the official standalone VAD executable.

Whisper CUDA 11 keeps its bundled runtime. Whisper's CUDA 12.4 build is distributed with the same CUDA 12.8 cuBLAS and CUDA Runtime components as Sherpa CUDA 12; it does not need cuDNN. Verified components are cached under `backends/.runtimes/<archive-sha256>` and hard-linked into backend directories, with copying as a fallback when hard links are unavailable. CUDA major versions and different cuDNN builds stay separate. Download estimates include the runtime archives before cache reuse; the upstream Whisper archive still contains its old DLLs, which are excluded during installation. An existing managed Sherpa package with missing runtime libraries can be completed without downloading its backend archive again; conflicting local files are never overwritten.