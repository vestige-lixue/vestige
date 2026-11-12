English | [中文](README.chs.md)

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="resources/logos/logo-white.svg" />
        <img src="resources/logos/logo-black.svg" alt="Vestige Logo" width="360" />
    </picture>
</p>

A local workspace for media transcription and proofreading.

## Motivation

Memories fade with time, and language can express only part of a thought.

A recording preserves a trace of a moment; a transcript turns part of that trace into text.

These fragments are where the name *Vestige* comes from: though the moment has long passed, we can still look back on the traces it left, as archaeologists do, from scattered words.

Automatic transcription gives us a first draft. Turning it into a record we can trust still takes careful listening: correcting misrecognized words, filling in omissions, and checking unfamiliar names. Switching back and forth between a media player and a text editor makes this work tedious, and makes it easy to lose track of where you left off.

Vestige brings listening, transcription, and proofreading into one workspace. The aim is to make careful proofreading easier and to keep the text connected to the recording, so that we can preserve and revisit the traces of the past.

## Features

1. **Fully local transcription**: Transcribe audio and video on your own computer with models compatible with whisper.cpp or sherpa-onnx.
2. **Smooth editing**: Compare multiple transcriptions, apply a custom vocabulary, and rely on autosave, undo/redo, and find/replace to proofread more efficiently.
3. **Playback and proofreading**: Listen to the original recording and jump to timestamps while reviewing the transcript, correcting mistakes, and filling in omissions.
4. **Saving projects**: Organize recordings and transcripts in `.vestige` project files in JSON format, with autosave and references to the original media files.
5. **Exporting transcripts**: Export the original or corrected transcripts as plain text or SRT subtitles.

## Development

### Requirements

- Node.js 24+
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

Packages are written to `dist/release/`. Windows packaging requires Inno Setup 6.3 or newer, installed in its default location or with `ISCC.exe` on PATH.

## Author

[@ljm12914](https://github.com/ljm12914)

## License

AGPL-3.0-or-later