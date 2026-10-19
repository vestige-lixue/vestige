Vestige brings media playback, transcription and proofreading into one workspace. A project can contain multiple media files, each with several transcription results.

Follow the steps below to prepare your first record. For more help with parameters, see the [parameter reference](params.en.md).

## From import to saving

1. Open Transcription backends and Transcription models from the Transcription menu and download a compatible pair.
2. Create a project and choose Import media from the Media menu, or drag audio or video files into the window.
3. Select a media item in the sidebar, open its transcription configuration, apply a suitable preset, and check the executor, backend folder, model folder and parameters before starting.
4. Follow progress in Transcription tasks. When the task finishes, listen to the recording while correcting its transcript.
5. Choose a project file location when saving for the first time. Further changes are saved automatically; reopen the project to continue later.

## Projects and media

Use the Project menu to create or open a project. A .vestige file stores media references, transcription results and proofreading edits. It does not copy the original audio or video into the project file.

Imported media appear in the sidebar. Select an item to show its player and transcript. You can rename it in the sidebar. Removing media also removes its transcription records from the current project, so check the selected item before confirming.

If a media file has moved, follow the prompt to locate the original file. Vestige checks that it matches. Keep the original audio or video and include it when sharing or backing up a project. If importing or reading fails, inspect the error details, then retry or dismiss the affected entry.

## Prepare a backend and model

Built-in presets combine an executor, backend folder, model folder and parameters. Download the corresponding resources in Transcription backends and Transcription models, then apply the preset in the transcription configuration. You can also copy a preset and adjust the combination. Vestige does not bundle a transcription backend; an empty backend field is not a default selection.

Open backend folder opens the default backends directory. Keep each backend in a separate subfolder, preserving its libraries and distribution notices. Select a folder containing whisper-cli or sherpa-onnx-offline (with .exe on Windows), either directly or inside bin/. Do not rename backend executables. You can also choose a folder elsewhere; relative paths resolve from the default backends directory.

Backends and models without a download configuration must be downloaded from their publishers manually.

Open model folder opens the default model directory for the current user. Keep each model in a separate subfolder. Extract and rename its files, then select that folder in the transcription configuration. Model files must be directly inside the selected folder, without an extra nested directory. You can also select a model folder elsewhere; relative paths resolve from the default model directory.

## Configure and run transcription

Select a media item and open its transcription configuration. The executor determines how to invoke the backend. The backend folder contains the program, while the model folder contains its model assets. All three must be compatible.

Apply a configuration from the presets window. Built-in presets cannot be edited or removed directly; copy one to change its name, folders and parameters. After applying a preset, you can still adjust parameters for the current transcription.

Starting transcription adds a task to the queue. Transcription tasks shows queued, running, completed, failed and stopped tasks, together with progress and console output. You can stop a task. After a failure, inspect that task's error details, adjust its configuration and retry. The settings control how many transcription tasks may run concurrently.

Each successful transcription retains a result. Its configuration is recorded when execution starts; later preset changes do not alter existing records.

## Playback and proofreading

Play or pause from the player, seek with the progress slider, and adjust speed and volume as needed. Previous word and Next word seek to neighboring transcribed words for repeated listening.

Insert, delete or replace text directly in the transcript. You can also add line breaks, copy and paste, and undo or redo edits. The player marks the text corresponding to the playback position. Proofreading edits are stored separately from the original transcription result.

Enable volume stabilization to make quiet passages easier to hear. It affects playback without rewriting the original media. Settings also control editor font size, spellchecking, playback-position retention, playback behavior after switching media or words, and the level meter.

## Review previous transcription results

Open the transcription records button on a media row to see its earlier results. Each record includes its execution time and configuration. Select a result to display it, or delete records you no longer need.

Switching the displayed result may discard proofreading edits based on the previous result; the interface asks for confirmation when needed. Deleting the displayed result also affects its edits, so read the confirmation text first.

## Save and resume work

Choose a project name and location the first time you save. Projects with a save location are saved automatically about every 10 seconds. Use Save as to save another copy. The Compress project files setting removes JSON whitespace to reduce file size.

When closing a project, opening another one or quitting, follow the prompts for unsaved content. If saving fails, retry or choose another location. Reopen the .vestige file to continue later; its original media must still be accessible.

## Common shortcuts

Mod means Ctrl on Windows and Linux, and Command on macOS. Text fields and the transcript editor have their own keyboard behavior; Space inserts a space while editing text.

| Action | Shortcut |
| --- | --- |
| New project | Mod + N |
| Open project | Mod + O |
| Save / Save as | Mod + S / Mod + Shift + S |
| Import media | Mod + I |
| Open transcription configuration | Mod + B |
| View transcription tasks | Mod + T |
| Play / Pause | Space |
| Previous word / Next word | Mod + Left / Mod + Right |
| Previous media / Next media | Mod + Shift + Left / Mod + Shift + Right |
| Undo / Redo | Mod + Z / Mod + Y |

## Settings and documentation

Settings control the interface language, theme colors, transcription concurrency, editing and playback preferences. Drag the divider to adjust the video preview height.

The document's actual file location appears at the beginning, followed by a table of contents generated from its headings. Local Markdown links open in the same window. Back restores the previous reading position. Web links open in your browser.

## Executors and model file names

### whisper.cpp

whisper.cpp normally runs Whisper speech recognition models, including Tiny, Base, Small, Medium, Large and compatible quantized variants. Use a GGML model supported by whisper.cpp; original PyTorch weights and ONNX models cannot be used directly.

```text
whisper-small/
    ggml-base.en.bin
```

Rename the downloaded model file (for example, ggml-small.bin) to ggml-base.en.bin. Vestige currently uses this fixed name to locate the file; it does not restrict the model to Base English. Do not change the file contents or assume changing its extension converts its format.

### sherpa-onnx

sherpa-onnx uses the offline speech recognition executor for compatible ONNX models such as Paraformer, Zipformer / Transducer, CTC and SenseVoice. Choose an export documented for offline recognition. Arbitrary ONNX files, streaming recognition models and speech synthesis models cannot be used directly. Support also depends on the installed executor version.

Model file names correspond to native options: remove the leading -- and append .onnx. For example, rename a Paraformer model.onnx file to paraformer.onnx. The table lists names recognized by Vestige. Include only the components required by your model, not every file in the table.

```text
sherpa-paraformer-zh/
    paraformer.onnx
    tokens.txt

zipformer/
    encoder.onnx
    decoder.onnx
    joiner.onnx
    tokens.txt
```

| Model family | Recognized file names |
| --- | --- |
| Transducer / Zipformer | `encoder.onnx`, `decoder.onnx`, `joiner.onnx` |
| Paraformer | `paraformer.onnx` |
| MedASR | `medasr.onnx` |
| FireRedASR CTC | `fire-red-asr-ctc.onnx` |
| TeleSpeech CTC | `telespeech-ctc.onnx` |
| Moonshine | `moonshine-encoder.onnx`, `moonshine-decoder.onnx`, `moonshine-merged-decoder.onnx`, `moonshine-preprocessor.onnx`, `moonshine-cached-decoder.onnx`, `moonshine-uncached-decoder.onnx` |
| Whisper ONNX | `whisper-encoder.onnx`, `whisper-decoder.onnx` |
| NeMo CTC | `nemo-ctc-model.onnx` |
| TDNN | `tdnn-model.onnx` |
| Zipformer CTC | `zipformer-ctc-model.onnx` |
| Dolphin | `dolphin-model.onnx` |
| WeNet CTC | `wenet-ctc-model.onnx` |
| SenseVoice | `sense-voice-model.onnx` |
| Omnilingual ASR | `omnilingual-asr-model.onnx` |
| Canary | `canary-encoder.onnx`, `canary-decoder.onnx` |
| FireRedASR | `fire-red-asr-encoder.onnx`, `fire-red-asr-decoder.onnx` |
| Cohere Transcribe | `cohere-transcribe-encoder.onnx`, `cohere-transcribe-decoder.onnx` |
| FunASR Nano | `funasr-nano-encoder-adaptor.onnx`, `funasr-nano-llm.onnx`, `funasr-nano-embedding.onnx` |
| Qwen3 ASR | `qwen3-asr-encoder.onnx`, `qwen3-asr-conv-frontend.onnx`, `qwen3-asr-decoder.onnx` |

When a model needs a token list, name it tokens.txt. Name the tokenizer folders for FunASR Nano and Qwen3 ASR funasr-nano-tokenizer and qwen3-asr-tokenizer respectively, preserving their internal structure.

Keep one model per folder. Its encoder, decoder, token list and other components must belong to the same compatible release. Quantized and other export variants must also use the listed names; variants with suffixes such as .int8 are not selected automatically. Moonshine components vary by version; follow the corresponding official example.

## Executor parameters

Add parameters one row at a time in the transcription configuration or preset editor. Keep the leading -- in the parameter name (or use a supported short option), and enter its value in the adjacent field. Leave the value empty for a flag without a value. Do not enter a complete shell command or add shell quoting.

| Key | Value |
| --- | --- |
| `--language` | `auto` |
| `--threads` | `4` |

The example above sets the language and thread count for whisper.cpp. Common sherpa-onnx options include --provider and --decoding-method. Available options vary by model and executor version; consult the linked documentation.

Vestige supplies audio input, model files and result output paths. Do not repeat these paths in your parameters. The whisper.cpp options -f / --file, -m / --model and -of / --output-file are managed by Vestige.

For more parameter help, example values and backend notes, see the [parameter reference](params.en.md).

## Troubleshooting

- Model not found: check the selected folder, names and extensions, and remove extra nesting after extraction. When the system hides extensions, avoid names ending in .onnx.onnx or .bin.bin.
- Model loading failed: check the executor, offline model format, component versions and token list. Renaming a file helps locate it; it does not convert the model format.
- Retry a failed or cancelled download. Check the console output, network connection and permission to write to the model folder. Do not use unfinished files for transcription before a download succeeds.
- Transcription and download tasks provide a progress bar and console output that can be copied. When total progress is unknown, the bar remains active; this does not necessarily mean the task is stuck. Stages such as model loading may produce no output for a while.

## Parameter documentation and more help

- [whisper.cpp: CLI parameter reference](https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md)
- [whisper.cpp: model formats, downloads and conversion](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md)
- [sherpa-onnx: model catalog and usage documentation](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/index.html)
- [sherpa-onnx: Paraformer parameters and examples](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-paraformer/paraformer-models.html)
- [sherpa-onnx: Zipformer parameters and examples](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html)
- [Whisper: model license](https://github.com/openai/whisper#license)
- [Chinese Paraformer model: source and license](https://www.modelscope.cn/models/iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8358-tensorflow1)
- [Vestige: report an issue](https://github.com/vestige-lixue/vestige/issues)