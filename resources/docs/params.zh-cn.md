参数名和值分别填写，参数名保留开头的 --。无值开关将值留空，不要添加命令行引号或填写完整命令。

Vestige 会提供音频输入、模型文件和结果输出路径，无需在参数表格中重复指定。

以下数值仅为填写示例。可用参数取决于后端版本和模型，详情请参阅对应的官方文档。

项目操作和完整流程请参阅[使用文档](README.zh-cn.md)；参数填写规则也可查看[执行器参数](README.zh-cn.md#执行器参数)。

## whisper.cpp

| 键 | 示例值 | 说明 |
| --- | --- | --- |
| `--language` | `auto` | 音频语言。auto 为自动识别，zh 和 en 分别指定中文与英文。 |
| `--threads` | `4` | CPU 计算线程数。 |
| `--beam-size` | `5` | 束搜索宽度。较大的值可能增加解码耗时。 |
| `--prompt` | `Vestige, Whisper` | 提供人名、专业术语等初始文本上下文，直接填写文本。 |
| `--translate` | 留空 | 将语音翻译为英文，需要模型支持翻译。 |
| `--no-gpu` | 留空 | 禁用 GPU 加速。希望使用 GPU 时不要添加此项，并选择支持 GPU 的后端。 |

- [CLI 参数文档](https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md)

## sherpa-onnx

| 键 | 示例值 | 说明 |
| --- | --- | --- |
| `--provider` | `cpu` | 推理设备，例如 cpu 或 cuda。使用 GPU 需要匹配的后端、依赖和硬件。 |
| `--num-threads` | `4` | 推理线程数。 |
| `--decoding-method` | `greedy_search` | 可填 greedy_search 或 modified_beam_search，后者适用于 Transducer 模型。 |
| `--max-active-paths` | `4` | modified_beam_search 的最大活跃路径数，对 greedy_search 无效。 |
| `--debug` | `true` | 向控制台输出模型诊断信息，填写 true 或 false。 |

- [Paraformer 参数与示例](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-paraformer/paraformer-models.html)
- [Zipformer 参数与示例](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html)
- [全部模型文档](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/index.html)