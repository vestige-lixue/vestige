Vestige brings media playback, transcription and proofreading into one workspace. A project can contain multiple media files, and each media file can keep several transcription results. Proofreading never changes a transcription result: your edits are stored alongside it, so the text keeps its connection to the recording.

For help with transcription parameters, see the [parameter reference](params.en.md).

## Getting started

1. In the Transcription menu, open Manage backends and Manage models, and download a backend and a model that work together.
2. Create a project, then choose Import from the Media menu, or drag audio or video files into the window.
3. Select a media item in the sidebar and open its transcription configuration. Apply a preset, check the executor, backend folder, model folder and parameters, then choose Start transcription.
4. Follow progress in Transcription tasks. When the task finishes, the transcript appears in the editor.
5. Play the recording and correct the transcript as you listen.
6. Save the project and choose a location for it. Later changes are saved automatically.

## Projects and media

Use the Project menu to create, open, save or close a project. A .vestige project file stores references to media files, transcription results and proofreading edits. It does not contain the audio or video itself.

To add media, choose Import from the Media menu, or drag media files or folders into the window. Dragging a single .vestige file opens that project instead. Imported media appear in the sidebar; select one to show its player and transcript.

- Double-click a media name to rename it. The file on disk keeps its name.
- Use Move earlier and Move later in the Media menu to reorder media.
- Remove from project removes the media, its transcripts and its edits from the project. The media file itself is not deleted.

When a media file is missing, has changed or cannot be read, its row shows the problem. Choose Locate file to point the project at the file again, or Ignore to dismiss the notice. Vestige compares the file size and an XXH3-64 hash of the full contents, so changing only the modification time does not affect the check. The selected media keeps its transcript even while its file is unavailable.

## Prepare a backend and model

Vestige does not include a transcription backend or model. Built-in presets combine an executor, backend folder, model folder and parameters. Download the matching resources in Manage backends and Manage models, then apply the preset in the transcription configuration. Backends and models without a download entry must be downloaded from their publishers.

Open backend folder opens the default backends folder. Keep each backend in its own subfolder, together with its libraries and license notices. The folder you select must contain whisper-cli or sherpa-onnx-offline (with .exe on Windows), either directly or in a bin subfolder. Do not rename backend programs. You can also select a folder elsewhere; relative paths start from the default backends folder. An empty backend folder field does not select a default backend.

Open model folder opens the default models folder. Keep each model in its own subfolder, rename its files as described in [Executors and model file names](#executors-and-model-file-names), then select that subfolder in the transcription configuration. Model files must sit directly inside the selected folder, without an extra nested folder. Relative paths start from the default models folder.

## Configure and run transcription

Select a media item and open its transcription configuration. The executor determines how the backend is run, the backend folder contains the program, and the model folder contains the model files. All three must match.

Apply a configuration from Manage presets. Built-in presets cannot be changed or deleted; duplicate one to change its name, folders and parameters. After applying a preset, you can still adjust the parameters for the current transcription only.

Starting a transcription adds a task to the queue. Transcription tasks lists queued, running, completed, failed and cancelled tasks, with their progress and console output. You can cancel a queued task or stop a running one. After a failure, choose View error details, adjust the configuration and try again. Settings control how many transcriptions run at the same time; downloads share the same capacity.

Each successful transcription is kept as a separate result together with the configuration used to start it. Changing a preset later does not change existing results.

## Proofreading

### Editing text

Type directly in the transcript to insert, delete or replace text, add line breaks, or cut, copy and paste. Undo and redo work across all of these edits. Added text is underlined with a dashed line. Hover over the end of a line to see whether it ends with a line break; an added line break is also underlined.

Edits keep their timing: original characters you keep still point to their place in the recording, so playback highlighting, seeking and inspection continue to work after proofreading.

### Deleted text and gaps

Deleting original text leaves a ▼ marker in its place. Click the marker to show the deleted text inline, and click it again to hide it. To show or hide all deleted text inside a selection, press Ctrl+Shift+D (⇧⌘D on macOS). Shown deleted text cannot be edited. A selection inside it copies only the deleted text, and a selection in the surrounding text never includes it.

To bring deleted text back, right-click the marker or the shown text and choose Restore deleted text. Text you typed next to the marker stays.

Some models report no-speech gaps; these appear as separate markers in the text.

### Inspecting timing and confidence

Hold Ctrl (⌘ on macOS) to inspect the text under the pointer, or the text at the caret or in the selection. The transcript outlines what is being inspected, and the progress bar marks its time range. After a short delay, a tooltip shows its confidence, no-speech probability, original text and time range. Settings can show this information in an information bar instead, and hide probabilities that need no attention.

While holding Ctrl (⌘), click text to play from there, or press Enter to play from the inspected text. Timestamps outside the media's length are shown in red, because those parts cannot be played.

### Right-click menu

Right-click a ▼ marker, a gap marker, a selection, a word or your own added text to see the actions available there:

- **Restore deleted text** and **Expand/Collapse deleted text** on deletion markers and shown deleted text.
- **Replace with** lists text that other transcriptions of the same media recognized at the same time. Choosing an entry replaces the selection with it. On a gap marker, the same list appears as **Insert**. The Reference overlap threshold setting decides how closely the times must overlap.
- **Vocabulary replacements** applies matching vocabulary rules, and **Add to vocabulary** creates a rule from a single-line selection.
- **Align with original** appears when text you typed contains characters that were deleted from the original. It marks those characters as original again, so they regain their timing. The displayed text does not change.
- Cut, Copy and Paste.

Actions that change the text are unavailable while the project is busy, for example during saving or opening.

### Find and replace

Press Ctrl+F (⌘F on macOS) to find text in the displayed transcript, or Ctrl+H (⌥⌘F on macOS) to show the replace field as well. Selected single-line text becomes the search text.

- Enter and Shift+Enter in the search field, or F3 and Shift+F3 (⌘G and ⇧⌘G on macOS), move to the next and previous match.
- Match Case, Match Whole Word and Preserve Case can be toggled with Alt+C, Alt+W and Alt+P (⌥⌘C, ⌥⌘W and ⌥⌘P on macOS).
- Enter in the replace field replaces the current match. Replace All (Ctrl+Alt+Enter, or ⌥⌘Enter on macOS) replaces every match as one undo step.
- Add to Vocabulary opens a new vocabulary rule filled with the search and replacement text.
- Escape closes the find bar.

Find searches only the displayed text, not hidden or shown deleted text. Match Whole Word treats letters, digits and combining marks as word characters. Chinese and Japanese have no spaces between words, so with this option a match there must be bounded by punctuation, spaces or the start or end of the text. Preserve Case applies the case pattern of each match (all uppercase, all lowercase or a capitalized first letter) to the replacement.

### Vocabulary

The vocabulary is a list of replacement rules shared by all projects. Open it from the Transcription menu or with Ctrl+L (⌘L on macOS). Each rule replaces one piece of text with another; an empty replacement deletes the text. Rules can be enabled, disabled, edited, searched and deleted.

Rules are never applied automatically. Right-click in the transcript and use Vocabulary replacements:

- With a selection, a rule replaces every non-overlapping occurrence inside the selection in one undo step. Select the whole transcript to apply it everywhere.
- Without a selection, a rule replaces the occurrence that touches the caret.

Matching compares characters exactly and has no notion of words, so the rule a → b also matches the a in banana. To limit a rule, include the surrounding characters, such as spaces, in both the original and the replacement text.

Export saves the vocabulary as JSON. Import accepts that JSON format, or UTF-8 text files with one rule per line and a tab between the original and the replacement text. Imported rules are added after the existing ones; invalid lines and duplicates are skipped and counted. If the vocabulary file cannot be read, choose Retry, or Back up and reset… to save a copy of the original file before starting with an empty vocabulary.

## Playback

Use the player to play or pause, seek with the progress bar, and change speed and volume. The player highlights the text being played; turn on Follow playback in Settings to keep it in view.

- F7 goes back and F9 goes forward by the jump amount set in Settings, without pausing or resuming playback. Hold the key to keep jumping.
- Previous word and Next word (Alt+← and Alt+→) jump between transcribed words, which helps when listening to a passage repeatedly.
- Previous file and Next file (Alt+↑ and Alt+↓) switch media.
- The playback mode decides what happens at the end of a media file: Stop after current, Play in order, Repeat all or Repeat one.
- Rewind when starting playback starts each playback slightly before the chosen point, so you hear the context.

Volume stabilization makes quiet passages easier to hear. It changes only what you hear, never the media file. Its strength can be adjusted under Advanced settings. The level meter can show the source audio, the audio after stabilization or the final output.

Settings also control the playback state after switching media or jumping to a word, whether each media file remembers its playback position, whether playback pauses when the audio output device changes, and an audio synchronization offset. Use the offset test if the highlighted text runs ahead of or behind the sound.

## Review previous transcription results

Open the Transcriptions button on a media row to see all of its results, each with its start time and configuration. Select a result to display it in the editor.

Edits belong to the displayed result. Switching to another result discards all edits, so Vestige asks for confirmation first. Deleting the displayed result also deletes its edits.

## Save and resume work

The first time you save, choose a name and location for the project. After that, the project is saved automatically about every 10 seconds. Use Save as to save another copy. The Compress project files setting removes whitespace from the JSON to make the file smaller.

The Media path storage mode setting decides how media locations are written:

- Absolute: every media file uses an absolute path.
- Relative inside project folder (default): media in the project's folder or its subfolders use relative paths; other media use absolute paths.
- Relative whenever possible: every media file uses a relative path unless that is impossible, for example across Windows drives.

Relative paths start from the folder containing the project file. The setting applies from the next save and never moves or copies media. When sharing or backing up a project, include its media and keep their positions relative to the project file.

When you close a project, open another one or quit, Vestige asks what to do with unsaved changes. If saving fails, try again or choose another location.

## Keyboard shortcuts

⇧ means Shift, ⌥ means Option and ⌘ means Command. Shortcuts that use Alt on Windows and Linux use ⌥⌘ on macOS.

### Project and app

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| New project | Ctrl+N | ⌘N |
| Open project | Ctrl+O | ⌘O |
| Save / Save as | Ctrl+S / Ctrl+Shift+S | ⌘S / ⇧⌘S |
| Close project | Ctrl+W | ⌘W |
| Import media | Ctrl+I | ⌘I |
| Open transcription configuration | Ctrl+B | ⌘B |
| Transcription tasks | Ctrl+T | ⌘T |
| Vocabulary | Ctrl+L | ⌘L |
| Settings | Ctrl+, | ⌘, |
| Quit | Ctrl+Q | ⌘Q |

### Playback

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Play / Pause | Space / F8 | Space / F8 |
| Go back / Go forward | F7 / F9 | F7 / F9 |
| Previous word / Next word | Alt+← / Alt+→ | ⌥⌘← / ⌥⌘→ |
| Previous file / Next file | Alt+↑ / Alt+↓ | ⌥⌘↑ / ⌥⌘↓ |
| Change playback mode | Ctrl+Shift+M | ⇧⌘M |
| Turn volume stabilization on or off | Ctrl+E | ⌘E |
| Restore playback speed | Ctrl+R | ⌘R |
| Focus the progress / speed / volume slider | Ctrl+Shift+P / Ctrl+Shift+R / Ctrl+Shift+E | ⇧⌘P / ⇧⌘R / ⇧⌘E |

While you edit text, Space types a space, but F7, F8 and F9 still control playback, even in text fields. Word and file navigation also work while editing; hold a word-navigation key to move one word at a time. Arrow-key combinations that are not listed keep their usual cursor behavior, and keys used by an input method stay with the input method while you compose text.

When the macOS top row is set to media controls, the rewind, play/pause and fast-forward keys work without Fn. Hardware play/pause keys also work on Windows, and system media controls work while Vestige is in the background.

### Editing

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Undo / Redo | Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z | ⌘Z / ⇧⌘Z |
| Inspect and play from the inspected text | Hold Ctrl, then click or press Enter | Hold ⌘, then click or press Enter |
| Show or hide deleted text in the selection | Ctrl+Shift+D | ⇧⌘D |
| Open the right-click menu from the keyboard | Menu key or Shift+F10 | — |

### Find and replace

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Find / Replace | Ctrl+F / Ctrl+H | ⌘F / ⌥⌘F |
| Next / previous match | Enter / Shift+Enter, F3 / Shift+F3 | Enter / ⇧Enter, ⌘G / ⇧⌘G |
| Replace / Replace all (in the replace field) | Enter / Ctrl+Alt+Enter | Enter / ⌥⌘Enter |
| Match Case / Match Whole Word / Preserve Case | Alt+C / Alt+W / Alt+P | ⌥⌘C / ⌥⌘W / ⌥⌘P |
| Close the find bar | Escape | Escape |

## Settings and documentation

Settings cover the interface language, project files, transcription concurrency, editing, playback, theme and volume stabilization. A theme has three colors for each of light and dark: accent, background and text. Surfaces, borders and other colors are derived from these three. Drag the divider below the video to change its height.

This guide shows its file location at the top, followed by a table of contents generated from its headings. Links to other local documents open in the same window, and Back returns to your previous reading position. Web links open in your browser.

## Executors and model file names

### whisper.cpp

whisper.cpp runs Whisper speech recognition models, including Tiny, Base, Small, Medium, Large and their quantized variants. Use a GGML model supported by whisper.cpp; original PyTorch weights and ONNX models cannot be used directly.

```text
whisper-small/
    model.bin
```

Rename the downloaded model file (for example, ggml-small.bin) to model.bin. Vestige uses this fixed name to find the model. Renaming a file does not convert its format.

**Upgrading from an older version:** rename ggml-base.en.bin in existing Whisper model folders, including models downloaded in the app, to model.bin. The file contents and folder name stay the same; no conversion or new download is needed.

### sherpa-onnx

sherpa-onnx runs compatible offline ONNX speech recognition models, such as Paraformer, Zipformer / Transducer, CTC and SenseVoice. Choose an export documented for offline recognition. Arbitrary ONNX files, streaming recognition models and speech synthesis models cannot be used. Support also depends on the backend version.

The Sherpa backends downloaded in the app include the sherpa-onnx-vad tool. A backend folder you set up yourself may omit it; Vestige then splits the audio into windows of limited length, placing the boundaries at quiet points. VAD only chooses where to split the audio and never discards any of it.

Model file names follow the backend's options: remove the leading -- and append .onnx. For example, rename a Paraformer model.onnx file to paraformer.onnx. The table lists the names Vestige recognizes. A model folder needs only the files its model uses, not every name in the table.

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

When a model needs a token list, name it tokens.txt. Name the tokenizer folders for FunASR Nano and Qwen3 ASR funasr-nano-tokenizer and qwen3-asr-tokenizer, keeping the files inside them unchanged.

Keep one model per folder. Its encoder, decoder, token list and other files must come from the same release. Quantized and other variants must also use the names above; files with suffixes such as .int8 are not picked up automatically. The files Moonshine needs differ between versions; follow the official example for yours.

## Executor parameters

Add parameters one row at a time in the transcription configuration or the preset editor. Enter the option name with its leading -- (or a supported short option) under Key, and its value under Value. Leave Value empty for an option without a value. Do not enter a whole command line or add shell quoting.

| Key | Value |
| --- | --- |
| `--language` | `auto` |
| `--threads` | `4` |

The example sets the language and thread count for whisper.cpp. Common sherpa-onnx options include --provider and --decoding-method. Available options depend on the model and the backend version; see the documentation linked below.

Vestige supplies the audio input, model files and output paths, so do not set them in parameters. For whisper.cpp, Vestige manages -f / --file, -m / --model and -of / --output-file.

For more parameter help, example values and backend notes, see the [parameter reference](params.en.md).

## Troubleshooting

- **Model not found:** check the selected folder and the file names and extensions, and remove any extra folder left from extraction. If your system hides file extensions, make sure no file ends in .onnx.onnx or .bin.bin.
- **Model fails to load:** check that the executor, the offline model format, the versions of its files and the token list all match. Renaming a file only helps Vestige find it; it does not convert the model.
- **Download failed or cancelled:** retry it. Check the console output, your network connection and whether the models folder can be written to. Do not use partly downloaded files for transcription.
- **A task seems stuck:** when total progress is unknown, the progress bar keeps moving without a percentage, and stages such as model loading can be silent for a while. Check the console output, which can be copied.
- **Media missing or changed:** choose Locate file on the media row. If the file contents changed, the original transcript may no longer match the recording.
- **The vocabulary cannot be read:** choose Retry after fixing the file, or Back up and reset… to keep a copy and start over.
- **Highlighted text is out of sync with the sound:** run the audio synchronization offset test in Playback settings.

## Parameter documentation and more help

- [whisper.cpp: CLI parameter reference](https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md)
- [whisper.cpp: model formats, downloads and conversion](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md)
- [sherpa-onnx: model catalog and usage documentation](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/index.html)
- [sherpa-onnx: Paraformer parameters and examples](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-paraformer/paraformer-models.html)
- [sherpa-onnx: Zipformer parameters and examples](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html)
- [Whisper: model license](https://github.com/openai/whisper#license)
- [Chinese Paraformer model: source and license](https://www.modelscope.cn/models/iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8358-tensorflow1)
- [Vestige: report an issue](https://github.com/vestige-lixue/vestige/issues)