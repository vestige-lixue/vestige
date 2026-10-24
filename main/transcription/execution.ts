import { join } from "node:path";
import { type Execution, type TaskLogReference } from "../../shared/transcription/Execution";
import { type AbsolutePath } from "../../shared/util/path";
import { type BackendLocation } from "../backends/resolve";
import { type ModelPlan } from "./ModelPlan";
import { type ParsedRequest } from "./parameters";

export function createExecution(request: ParsedRequest, backend: BackendLocation, model: ModelPlan, ffmpeg: AbsolutePath, vadModelPath: AbsolutePath, duration: number, log: TaskLogReference | null): Execution {
    const program = (path: string): Execution["plan"]["backend"]["program"] => ({ path, version: null, sha256: null });
    return {
        request: { ...request.config, params: { ...request.config.params }, mediaPath: request.mediaPath, mediaDuration: request.mediaDuration },
        plan: {
            executor: request.executor,
            backend: {
                directory: backend.directory,
                program: program(backend.executable),
                tools: Object.entries(backend.tools).map(([role, tool]) => ({
                    role, program: tool.executable ? program(tool.executable) : null,
                    model: role === "vad" ? { path: vadModelPath, sha256: null } : null, required: tool.required
                }))
            },
            model: { directory: request.modelDirectory, files: model.files.map(file => ({ role: file.role, path: join(request.modelDirectory, file.filename), sha256: null })) },
            audio: { program: program(ffmpeg), stream: "0:a:0", sampleRate: 16000, channels: 1, format: "pcm-s16le", duration },
            options: { ...model.options },
            nativeDefaults: null,
            strategy: { ...model.strategy, version: 1 },
            segmentation: { maximumDuration: null, batchSize: 1 },
            parts: [{ start: 0, end: duration }]
        },
        deviations: [],
        log: log ? { ...log } : null
    };
}