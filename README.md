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

## Author

[@ljm12914](https://github.com/ljm12914)

## License

MIT