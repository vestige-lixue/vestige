# Native programs

Prepare the native programs for the release target before packaging. The downloader uses the project's Node.js runtime and system `tar` (Windows includes it). On Unix, extracting a ZIP also requires `unzip`.

From the repository root:

```sh
node resources/bin/download.mjs --dry-run
node resources/bin/download.mjs
```

`--dry-run` reads release metadata and prints the selected files without downloading programs or changing local files. `--platform win32|linux|darwin` and `--arch x64|arm64` select a packaging target; defaults come from Node.js. `GITHUB_TOKEN` is optional for GitHub API rate limits.

Use `--only ffmpeg`, `--only sherpa-onnx` or `--only whisper.cpp` to select one package. For example, `node resources/bin/download.mjs --only ffmpeg` installs both `ffmpeg` and `ffprobe` with their matching shared libraries. `ffprobe` is a separate executable required for importing media.

An ordinary run downloads all three packages into a temporary directory, checks every downloaded file against its GitHub SHA-256 digest, and retains the required CLI programs, shared libraries and distribution notices. After all selected packages are ready, it replaces their program directories. Close Vestige before updating, because running processes may lock old binaries. The downloader neither compiles source nor downloads models.

When the target matches the current platform and architecture, the downloader also runs `ffmpeg -version` and `ffprobe -version` before replacing existing files. A startup failure leaves the installed programs intact.

The resulting layout is:

```text
resources/bin/
  ffmpeg/ffmpeg[.exe]
  ffmpeg/ffprobe[.exe]
  sherpa-onnx/sherpa-onnx-offline[.exe]
  whisper.cpp/whisper-cli[.exe]
```

Each directory also holds its shared libraries, `licenses/` and a `download.json` recording the resolved release and an `assets` array with each file's URL and digest. Whisper's runtime backend libraries are retained; benchmark, server and example executables are omitted. Generated programs are local packaging inputs ignored by Git; the downloader and this document remain tracked.

## Upstream sources and supported targets

- **FFmpeg and ffprobe:** Windows and Linux use [BtbN's latest shared LGPL builds](https://github.com/BtbN/FFmpeg-Builds/releases/latest), linked by the [FFmpeg download page](https://ffmpeg.org/download.html). The downloader keeps selecting BtbN's latest automatic FFmpeg master build. macOS uses the latest [ffmpeg-static release](https://github.com/eugeneware/ffmpeg-static/releases), downloading `ffmpeg-darwin-<arch>`, `ffprobe-darwin-<arch>` and that architecture's LICENSE and README assets individually. Its release tag does not necessarily describe every included binary's FFmpeg version; these builds also have their own codec and license configuration.
- **sherpa-onnx:** [the latest official release](https://github.com/k2-fsa/sherpa-onnx/releases/latest), using CPU shared-library packages, including `osx-arm64-shared` and `osx-x64-shared` on macOS. The selected Windows and Linux x64 packages omit text-to-speech components.
- **whisper.cpp:** [official releases](https://github.com/ggml-org/whisper.cpp/releases), selecting the newest non-draft build among the latest 20 releases that contains the requested CLI archive. A semantic version release may contain only source; its linked `b...` build supplies the binaries. When upstream has no macOS CLI archive, the downloader uses the latest published, non-prerelease `native-whisper-...` release from [macos-whisper-cli](https://github.com/vestige-lixue/macos-whisper-cli/releases/latest). It requires both architecture archives, `SHA256SUMS` and `build.json` with GitHub SHA-256 digests before accepting that release. CI archives supply Whisper's own LICENSE; other inference archives use the upstream source license from their selected tag.

The configured targets cover Windows, Linux and macOS, each on x64/arm64. macOS requires a published Whisper CLI archive from upstream or the workflow below. Linux Whisper packages are upstream Ubuntu builds; their system-library requirements still apply. Unsupported targets and missing release assets fail before replacing any programs. The macOS arm64 Whisper CI build includes Metal; the other configured inference packages use CPU backends.

Electron Builder copies this directory to `process.resourcesPath/bin`, outside the application's ASAR archive. Models stay in the user's `models` directory. Each transcription gets a temporary working directory and a directory link to its selected model, so model files do not need to be copied.

## Building macOS Whisper CLI packages

The independent [macos-whisper-cli repository](https://github.com/vestige-lixue/macos-whisper-cli) owns the build workflow. It checks official stable versions daily at 03:23 UTC and starts macOS builds only when the source commit or build recipe changes. Both architectures use the same pinned upstream commit. The application repository no longer builds or publishes these dependencies.

The native arm64 and Intel builds target macOS 13.3, with dynamic CPU backend selection and `@loader_path` library lookup. arm64 embeds Metal; Intel uses CPU backends. Each build runs upstream's `gh` tests and exercises JSON output from an extracted archive after moving the build directory aside. The bundled test model checks execution and output structure, not transcription accuracy with a real model or compatibility on the oldest supported OS.

Both architectures must pass before publication. The release contains `whisper-bin-macos-arm64.tar.gz`, `whisper-bin-macos-x64.tar.gz`, `SHA256SUMS` and `build.json`; the manifest records the exact upstream commit and recipe fingerprint. Uploads remain a draft until every asset has been verified. Failed builds and incomplete drafts retry on subsequent checks. Manual builds of older versions do not replace Latest.

Commit the independent repository's workflow to its default branch and run **Actions → Build macOS Whisper CLI → Run workflow** once, or wait for its first scheduled build. Leave the version input empty to select the latest stable version. After that first publication, application builds and forks reuse the published files without compiling Whisper. Set the local environment variable or the application repository's Actions variable `VESTIGE_NATIVE_REPOSITORY=owner/repo` to use another repository implementing the same release format. No personal token is required for the default public source.

```sh
node resources/bin/download.mjs --platform darwin --arch arm64 --dry-run
node resources/bin/download.mjs --platform darwin --arch arm64
```

Use `--arch x64` for Intel. These commands replace local packaging resources with the selected target's files; prepare each architecture in a separate checkout or packaging job. The workflow does not produce a universal app or perform the application's Developer ID signing and notarization.