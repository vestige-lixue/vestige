# Native programs

Prepare the native programs for the release target before packaging. The downloader uses the project's Node.js runtime and system `tar` (Windows includes it). On Unix, extracting a ZIP also requires `unzip`.

From the repository root:

```sh
node resources/bin/download.mjs --dry-run
node resources/bin/download.mjs
```

`--dry-run` reads release metadata and prints the selected files without downloading archives or changing local programs. `--platform win32|linux` and `--arch x64|arm64` select a packaging target; defaults come from Node.js. `GITHUB_TOKEN` is optional for GitHub API rate limits.

Use `--only ffmpeg`, `--only sherpa-onnx` or `--only whisper.cpp` to select one package. For example, `node resources/bin/download.mjs --only ffmpeg` installs both `ffmpeg` and `ffprobe` with their matching shared libraries. `ffprobe` is a separate executable required for importing media.

An ordinary run downloads all three packages into a temporary directory, checks each archive against its GitHub SHA-256 digest, and retains the required CLI programs, shared libraries and distribution notices. After all selected packages are ready, it replaces their program directories. Close Vestige before updating, because running processes may lock old binaries. The downloader neither compiles source nor downloads models.

When the target matches the current platform and architecture, the downloader also runs `ffmpeg -version` and `ffprobe -version` before replacing existing files. A startup failure leaves the installed programs intact.

The resulting layout is:

```text
resources/bin/
  ffmpeg/ffmpeg[.exe]
  ffmpeg/ffprobe[.exe]
  sherpa-onnx/sherpa-onnx-offline[.exe]
  whisper.cpp/whisper-cli[.exe]
```

Each directory also holds its shared libraries, `licenses/` and a `download.json` recording the resolved release, asset URL and digest. Whisper's CPU backend libraries are retained; benchmark, server and example executables are omitted. Generated programs are local packaging inputs ignored by Git; the downloader and this document remain tracked.

## Upstream sources and supported targets

- **FFmpeg and ffprobe:** [BtbN's latest shared LGPL builds](https://github.com/BtbN/FFmpeg-Builds/releases/latest), linked by the [FFmpeg download page](https://ffmpeg.org/download.html). FFmpeg itself distributes source; the downloader selects BtbN's latest automatic build from FFmpeg master for the target platform and architecture.
- **sherpa-onnx:** [the latest official release](https://github.com/k2-fsa/sherpa-onnx/releases/latest), using CPU shared-library packages. The selected Windows and Linux x64 packages omit text-to-speech components.
- **whisper.cpp:** [official releases](https://github.com/ggml-org/whisper.cpp/releases), selecting the newest published build among the latest 20 releases that contains the requested CPU CLI archive. A semantic version release may contain only source; its linked `b...` build supplies the binaries. The downloader also fetches both inference projects' licenses from their selected tags.

The configured complete sets cover Windows x64/arm64 and Linux x64/arm64. Linux Whisper packages are upstream Ubuntu builds; their system-library requirements still apply. macOS currently has no configured complete set because the official Whisper Apple asset is an XCFramework rather than `whisper-cli`. Unsupported targets and missing upstream assets fail explicitly. For such targets, place the native CLI binaries, their libraries and notices in the layout above. GPU variants and their driver requirements are not selected by the downloader.

Electron Builder copies this directory to `process.resourcesPath/bin`, outside the application's ASAR archive. Models stay in the user's `models` directory. Each transcription gets a temporary working directory and a directory link to its selected model, so model files do not need to be copied.