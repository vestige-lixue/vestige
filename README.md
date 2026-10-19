English | [中文](README.chs.md)

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="resources/logos/logo-white.svg" />
        <img src="resources/logos/logo-black.svg" alt="Vestige Logo" width="360" />
    </picture>
</p>

A local workspace for media transcription and proofreading.

## Motivation

Memories fade with time, and language captures only part of a thought.

A recording preserves a trace of a moment; a transcript carries some of that trace into text.

These are the fragments that give *Vestige* its name: something we can return to when the moment itself is gone.

Automatic transcription gives us a draft. Turning it into a record we can trust still takes close listening: correcting misheard words, filling in omissions, and checking unfamiliar names. Moving between a media player and a text editor makes this work tedious and easy to lose track of.

Vestige brings listening, transcription, and proofreading into one workspace. The aim is to make careful review easier, keeping the text connected to the recording so that we can preserve and revisit what was said.

## Features

1. **Fully local transcription**: Transcribe audio and video on your own computer with any model compliant with whisper.cpp and sherpa-onnx.
2. **Multiple transcription results**: Keep results from different models alongside the same recording and choose one as the basis for corrections.
3. **Custom vocabulary**: Keep reusable word and phrase corrections and get matching suggestions while proofreading.
4. **Playback and proofreading**: Listen to the source recording while reviewing the transcript, correcting mistakes, and filling in missing words.
5. **Saving projects**: Organize recordings and transcripts in `.vestige` files in JSON format, with automatic saving and references to the original media files.
6. **Exporting transcripts**: Export the original transcripts or the corrected versions in plain text or SRT subtitle format.

## Development

### Requirements

- Node.js 22.12+ (22.x) or 24+
- pnpm 12.5.1
- Git

### Starting the development server

```shell
pnpm install
pnpm dev
```

### Packaging the application

Use the command for your platform:

```shell
pnpm build:win   # Windows
pnpm build:mac   # macOS
pnpm build:linux # Linux
```

Packages are written to `dist/release/`.

### Building releases with GitHub Actions

The [Build release workflow](.github/workflows/release.yml) builds Windows NSIS installers, macOS DMG files, and Linux AppImages for both x64 and arm64 on native runners. Each job installs the pnpm version from `package.json`, uses the frozen lockfile, downloads the target's native programs, and runs the existing typecheck and build commands before packaging.

Transcription backends and models are downloaded in the app, rather than bundled with installers. Packaging prepares only FFmpeg / ffprobe and aria2; see [native program preparation](resources/bin/README.md) for supported targets. The [macos-whisper-cli repository](https://github.com/vestige-lixue/macos-whisper-cli) supplies downloadable macOS Whisper backends through the application catalog.

- **Manual build:** Commit the workflow to the default branch, then open **Actions → Build release → Run workflow**. Choose a branch and either `all` or one platform/architecture. Download the packages from the run's **Artifacts**; they are retained for 14 days. Manual runs only upload artifacts.
- **Release draft:** Set `package.json` to the intended version, commit it, then push the matching tag, such as `v0.1.0`. After all six builds succeed, the workflow creates a GitHub Release draft containing the installers and `SHA256SUMS`. Tags must exactly match `v` followed by the package version. Versions with a prerelease suffix create prerelease drafts. Review the files and notes in **Releases**, then publish the draft.

Re-running a tag build updates an existing draft; published release assets are never overwritten. Only the release job receives `contents: write`, using GitHub's built-in token. No additional secrets are required. Windows installers are unsigned; macOS apps use ad-hoc signing without Developer ID signing or notarization, so operating-system trust prompts still apply.

## Author

[@ljm12914](https://github.com/ljm12914)

## License

AGPL-3.0-or-later