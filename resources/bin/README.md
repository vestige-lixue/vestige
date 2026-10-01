# Native programs

Place the native programs for the release target in these directories before packaging:

```text
resources/bin/
  ffmpeg/ffmpeg[.exe]
  sherpa-onnx/sherpa-onnx-offline[.exe]
  whisper.cpp/whisper-cli[.exe]
```

Keep each program's required native libraries and distribution notices alongside it. Include Whisper's CPU backend libraries; benchmark, server, test and other example executables are unnecessary. `resources/bin` is local packaging input and is ignored by Git. Each release contains the programs for its target system and architecture, using the same directory names.

Electron Builder copies this directory to `process.resourcesPath/bin`, outside the application's ASAR archive. Models stay in the user's `models` directory. Each transcription gets a temporary working directory and a directory link to its selected model, so model files do not need to be copied.

The black and white PNG icons are checked in under `resources/icons`. The local generator is `.local/generate-theme-icons.mjs` (`pnpm icons`); generation scripts are excluded from Git.