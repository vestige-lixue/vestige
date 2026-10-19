Enter each parameter name and value in separate fields. Keep the leading --. Leave the value empty for a flag; do not add shell quotes or a complete command.

Vestige supplies the audio input, model files and result output paths. Do not repeat these paths in the parameter table.

The values below are examples. Available options depend on your backend version and model; consult the official documentation for details.

For project operations and the complete workflow, see the [user guide](README.en.md). Parameter entry rules are also covered under [Executor parameters](README.en.md#executor-parameters).

## whisper.cpp

| Key | Example value | Description |
| --- | --- | --- |
| `--language` | `auto` | Spoken language: auto detects it; zh and en specify Chinese and English. |
| `--threads` | `4` | Number of CPU computation threads. |
| `--beam-size` | `5` | Beam search width. Larger values can increase decoding time. |
| `--prompt` | `Vestige, Whisper` | Initial text context, such as names and specialized terms. Enter the text directly. |
| `--translate` | Leave empty | Translate speech into English. Requires a model that supports translation. |
| `--no-gpu` | Leave empty | Disable GPU acceleration. Leave this option out to allow a GPU-capable backend to use the GPU. |

- [CLI parameter documentation](https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md)

## sherpa-onnx

| Key | Example value | Description |
| --- | --- | --- |
| `--provider` | `cpu` | Inference provider, such as cpu or cuda. GPU use requires a matching backend, dependencies and hardware. |
| `--num-threads` | `4` | Number of inference threads. |
| `--decoding-method` | `greedy_search` | greedy_search or modified_beam_search. The latter is for Transducer models. |
| `--max-active-paths` | `4` | Maximum active paths for modified_beam_search; does not apply to greedy_search. |
| `--debug` | `true` | Print model diagnostics to the console. Use true or false. |

- [Paraformer parameters and examples](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-paraformer/paraformer-models.html)
- [Zipformer parameters and examples](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html)
- [All model documentation](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/index.html)