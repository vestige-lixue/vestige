import { type AbsolutePath } from "../../shared/util/path";
import { parseAbsolutePath, resolveFilePath } from "../util/file";
import { isExecutor, type TranscriptionRequest } from "../../shared/transcription/executor";
import { type Config } from "../../shared/transcription/Config";
import { VestigeErrors } from "../../shared/failure";

export type ParsedRequest = Omit<TranscriptionRequest, "modelDirectory"> & {
    modelDirectory: AbsolutePath;
    options: Record<string, string>;
    startedAt: number;
    config: Config;
};

export function parseRequest(value: unknown, modelRoot: AbsolutePath): ParsedRequest {
    const startedAt = Date.now();
    if (!value || typeof value !== "object") throw new VestigeErrors({ kind: "transcription-invalid-request" });
    const request = value as Record<string, unknown>;
    if (!isExecutor(request.executor)) {
        throw new VestigeErrors({ kind: "transcription-unknown-executor", executor: String(request.executor) });
    }
    for (const key of ["backendDirectory", "modelDirectory", "mediaPath"] as const) {
        if (typeof request[key] !== "string" || !request[key].trim() || request[key].includes("\0")) {
            throw new VestigeErrors({ kind: "transcription-empty-path", field: key });
        }
    }
    if (typeof request.params !== "string") throw new VestigeErrors({ kind: "transcription-params-text" });
    if (typeof request.mediaDuration !== "number" || !Number.isFinite(request.mediaDuration) || request.mediaDuration < 0) {
        throw new VestigeErrors({ kind: "transcription-invalid-request" });
    }
    let params: unknown;
    try {
        params = JSON.parse(request.params);
    }
    catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new VestigeErrors({ kind: "transcription-invalid-json", diagnostic: error.message }, { cause: error });
    }
    if (!params || typeof params !== "object" || Array.isArray(params)) {
        throw new VestigeErrors({ kind: "transcription-params-object" });
    }
    for (const [key, value] of Object.entries(params)) {
        if (!key || key.includes("\0")) throw new VestigeErrors({ kind: "transcription-invalid-option", option: key });
        if (typeof value !== "string") throw new VestigeErrors({ kind: "transcription-param-value" });
        if (value.includes("\0")) throw new VestigeErrors({ kind: "transcription-param-null" });
    }
    return {
        executor: request.executor,
        backendDirectory: request.backendDirectory as string,
        modelDirectory: resolveFilePath(modelRoot, request.modelDirectory as string),
        mediaPath: parseAbsolutePath(request.mediaPath),
        mediaDuration: request.mediaDuration,
        params: request.params,
        options: params as Record<string, string>,
        startedAt,
        config: {
            executor: request.executor,
            backendDirectory: request.backendDirectory as string,
            modelDirectory: request.modelDirectory as string,
            params: { ...params as Record<string, string> }
        }
    };
}