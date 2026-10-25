# Voice activity detection

Silero VAD v6.2, the official unquantized ONNX model, is bundled as a fixed audio preprocessing resource. It runs on CPU through the selected backend's official `sherpa-onnx-vad` executable. Sherpa executables and native runtime libraries remain downloadable backend components.

Run `node resources/bin/download.mjs --only vad` from the repository root to prepare the model before development or packaging. The default downloader run also includes VAD. The model and generated `download.json` are ignored by Git; this document and the license remain tracked and are preserved during downloads.

- Model: https://raw.githubusercontent.com/snakers4/silero-vad/v6.2/src/silero_vad/data/silero_vad.onnx
- Model SHA-256: `1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3`
- License: MIT, https://github.com/snakers4/silero-vad/blob/v6.2/LICENSE

VAD suggests pauses for splitting audio. Every Sherpa input slice is at most 20 seconds. All source audio is retained, including regions VAD does not classify as speech. If VAD is unavailable or finds no pauses, quiet points near the duration limit are used instead. Slice timestamps are mapped back to the original audio timeline.

Qwen truncation and repetition-loop warnings trigger bounded retries. A failing batch is isolated into individual windows, then affected windows are bisected up to three times, stopping below four seconds. A remaining repetition loop gets one attempt with temperature 0.4 unless the user explicitly configured temperature. This affects only failed windows, and the effective parameters are logged. No samples are discarded, successful windows remain in timeline order, and an unrecoverable window fails the task with its original time range.