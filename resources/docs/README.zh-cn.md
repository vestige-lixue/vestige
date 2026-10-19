Vestige 将音视频播放、转写与文本校对放在同一个工作空间中。一个项目可以包含多份媒体，每份媒体可以保留多次转写结果。

第一次使用时，可以按下面的顺序完成一份记录。更多参数相关帮助请参阅[参数指南](params.zh-cn.md)。

## 从导入到保存

1. 在“转写”菜单中打开“转写后端”和“转写模型”，下载一组相互匹配的资源。
2. 新建项目，使用“媒体”菜单中的“导入媒体”选择音频或视频，也可以将文件拖入窗口。
3. 在侧栏选择媒体，打开转写配置，应用对应预设并检查执行器、后端目录、模型目录和参数，然后开始转写。
4. 在转写任务窗口查看进度。完成后，一边播放，一边在正文中修正识别结果。
5. 首次保存时选择项目文件位置。保存后的项目会自动保存后续修改；以后打开该项目即可继续。

## 项目与媒体

通过“项目”菜单新建或打开项目。项目使用 .vestige 扩展名，保存媒体引用、转写结果及校对修改，不会把原始音视频文件复制进项目。

导入后，侧栏会列出媒体。选中一项即可查看其播放器和转写正文。媒体名称可以在侧栏修改；移除媒体会将它及其转写记录从当前项目移除，请在确认前检查所选媒体。

媒体文件移动后，按提示重新定位原文件。应用会核对文件是否匹配；请保留原始音视频，分享或备份项目时也一并保存这些文件。导入或读取失败时，可以查看错误详情，再重试或忽略相应条目。

## 准备后端与模型

内置预设已组合好执行器、后端目录、模型目录和参数。在“转写后端”和“转写模型”管理窗口下载对应资源后，在转写配置中应用预设即可。也可以复制预设，再调整组合。Vestige 不再内置转写后端，后端目录留空不代表默认选择。

“打开后端文件夹”会打开默认后端目录。每个后端放在独立子文件夹内，保留依赖库和分发声明。所选文件夹或其 bin 子文件夹中应包含 whisper-cli 或 sherpa-onnx-offline（Windows 下带 .exe），不要更改后端程序名称。也可以选择其他位置的后端文件夹；相对路径以默认后端目录为起点。

未提供下载配置的后端和模型，需要自行从发布者处下载。

“打开模型文件夹”会打开当前用户的默认模型目录。每个模型放在独立子文件夹内，解压、重命名后，在转写配置中选择模型文件夹。该文件夹中应直接包含模型文件，避免多套一层目录。也可以选择其他位置的模型文件夹；默认模型目录下的相对路径相对于这个目录解析。

## 配置和执行转写

选择媒体后打开转写配置。执行器决定如何调用后端；后端目录指向程序，模型目录指向模型资源。三者需要相互匹配。

可以从预设窗口应用一组配置。内置预设不能直接修改或删除；复制后可以调整名称、目录和参数，保存为自己的预设。应用预设后，仍可在本次转写配置中调整参数。

点击开始后，任务会进入队列。“转写任务”窗口显示等待、执行、完成、失败或已停止的任务，以及相应进度和控制台输出。可以停止任务；失败后查看该任务的错误详情，调整配置再重试。在设置中可以调整转写并行任务数。

每次成功转写都会保留一份结果。执行开始时的配置会随该次结果记录，之后修改预设不会改变已有记录。

## 播放与校对

在播放器中播放或暂停，使用进度条定位，并按需要调整速度和音量。上一词、下一词操作可以跳到相邻转写词语的位置，方便反复聆听。

在正文中直接插入、删除或替换文字，也可以换行、复制和粘贴。使用撤销和重做修正编辑操作。播放器会标示当前播放位置对应的文字；文本校对与原始转写结果分别保存。

需要更清楚地聆听小声内容时，可以开启稳定音量。它用于调整播放听感，不会改写原始媒体。设置中可以调整编辑器字号、拼写检查、播放进度保留、媒体或词语切换后的播放行为，以及电平显示。

## 查看历史转写结果

点击媒体行中的转写记录按钮，可查看该媒体的历次结果。记录包含执行时间和当时使用的配置，可以选择显示其中一份，也可以删除不再需要的结果。

切换当前显示的结果可能清除基于原结果的校对修改，界面会在需要时提示确认。删除当前显示的结果也会影响相应修改，请先核对提示。

## 保存与继续工作

首次使用“保存”时，为项目选择文件名和位置。已有保存位置的项目每隔约 10 秒自动保存一次；使用“另存为”可以另存一份项目。设置中的“压缩项目文件”会去除 JSON 空白符以减少体积。

关闭项目、打开另一项目或退出应用时，按界面提示处理尚未保存的内容。出现保存失败时，可以重试或选择其他位置。下次打开 .vestige 文件即可继续；原始媒体仍需保持可访问。

## 常用快捷键

下表中的 Mod 在 Windows 和 Linux 上表示 Ctrl，在 macOS 上表示 Command。输入框或正文编辑器具有自己的键盘操作，空格在编辑文字时用于输入空格。

| 操作 | 快捷键 |
| --- | --- |
| 新建项目 | Mod + N |
| 打开项目 | Mod + O |
| 保存 / 另存为 | Mod + S / Mod + Shift + S |
| 导入媒体 | Mod + I |
| 打开转写配置 | Mod + B |
| 查看转写任务 | Mod + T |
| 播放 / 暂停 | Space |
| 上一词 / 下一词 | Mod + Left / Mod + Right |
| 上一媒体 / 下一媒体 | Mod + Shift + Left / Mod + Shift + Right |
| 撤销 / 重做 | Mod + Z / Mod + Y |

## 设置与阅读文档

设置中可以选择界面语言、主题配色、转写并行任务数、编辑和播放偏好。视频预览区域的高度可以通过分隔条调整。

文档开头显示实际文件位置，目录根据标题自动生成。点击本地 Markdown 链接会在当前窗口打开目标文档；使用“返回”可恢复上次的阅读位置。网页链接会在浏览器中打开。

## 执行器与模型文件名称

### whisper.cpp

whisper.cpp 通常用于运行 Whisper 系列语音识别模型，包括 Tiny、Base、Small、Medium、Large 及其兼容的量化版本。必须使用 whisper.cpp 支持的 GGML 模型文件；原始 PyTorch 权重或 ONNX 模型不能直接使用。

```text
whisper-small/
    ggml-base.en.bin
```

将下载的模型文件（例如 ggml-small.bin）更名为 ggml-base.en.bin。Vestige 当前固定使用这个名称定位文件，它不代表只能使用 Base 英文模型。不要改变文件内容或仅通过改扩展名转换格式。

### sherpa-onnx

sherpa-onnx 使用离线语音识别执行器，通常运行 Paraformer、Zipformer / Transducer、CTC、SenseVoice 等适配 sherpa-onnx 的 ONNX 模型。请选择官方标注为离线识别的导出版本；任意 ONNX 文件、在线识别模型、语音合成模型不能因此直接使用。具体支持范围还取决于安装的执行器版本。

模型文件名称与执行器参数对应：去掉参数名开头的 --，加上 .onnx。例如 Paraformer 的 model.onnx 需要更名为 paraformer.onnx。下表列出 Vestige 会识别的名称；只放入所选模型实际需要的一组文件，无需下载表中的所有文件。

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

| 模型类型 | 识别的文件名称 |
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

模型需要词表时，词表必须命名为 tokens.txt。FunASR Nano 和 Qwen3 ASR 需要的 tokenizer 目录分别命名为 funasr-nano-tokenizer、qwen3-asr-tokenizer，并保留其内部文件结构。

同一文件夹只放一个模型，编码器、解码器、词表等必须来自匹配的同一套发布文件。量化或不同导出版本也需采用上表名称；不自动选择带 .int8 等后缀的变体。Moonshine 各版本所需组件不同，应按对应官方示例准备。

## 执行器参数

在转写配置或预设的参数编辑器中逐行填写参数名和值。参数名保留开头的 --（或执行器支持的短选项），参数值填入右侧输入框。无值开关将值留空，不要填写完整命令行或额外加入命令行引号。

| Key | Value |
| --- | --- |
| `--language` | `auto` |
| `--threads` | `4` |

以上是 whisper.cpp 的语言和线程数示例。sherpa-onnx 常用参数包括 --provider 和 --decoding-method；可用参数随模型类型和执行器版本变化，请参阅下方对应文档。

Vestige 会提供音频输入、模型文件及结果输出路径，不要在参数中重复指定这些路径。whisper.cpp 的 -f / --file、-m / --model、-of / --output-file 由 Vestige 管理。

更多参数相关帮助、示例值和后端说明请参阅[参数指南](params.zh-cn.md)。

## 常见问题

- 找不到模型：检查选中的文件夹、名称和扩展名，确认解压后没有多余的嵌套目录。系统隐藏扩展名时，注意避免 .onnx.onnx 或 .bin.bin。
- 加载模型失败：核对执行器、离线模型格式、组件版本和词表是否匹配。重命名只用于定位文件，不能转换模型格式。
- 下载失败或取消后可以重试。请先查看控制台输出，检查网络连接和模型目录写入权限。下载成功前不要将未完成文件用于转写。
- 转写任务和下载任务都提供进度条与可复制的控制台输出。无法确定总体进度时，进度条会持续活动；这不一定表示任务停滞。模型加载等阶段可能暂时没有新输出。

## 参数文档与更多帮助

- [whisper.cpp：CLI 参数文档](https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md)
- [whisper.cpp：模型格式、下载与转换](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md)
- [sherpa-onnx：模型目录与各模型使用文档](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/index.html)
- [sherpa-onnx：Paraformer 参数与示例](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-paraformer/paraformer-models.html)
- [sherpa-onnx：Zipformer 参数与示例](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html)
- [Whisper：模型许可证](https://github.com/openai/whisper#license)
- [Paraformer 中文模型：来源与许可证](https://www.modelscope.cn/models/iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8358-tensorflow1)
- [Vestige：问题反馈](https://github.com/vestige-lixue/vestige/issues)