import { type AbsolutePath } from "../../shared/util/path";
import { filePath, resolveFilePath } from "../util/file";
import { type TranscriptionRequest } from "../../shared/transcription/executer";
import { type Config } from "../../shared/transcription/Config";
import { TranscriptionFailure } from "./failure";

export type ParsedRequest = Omit<TranscriptionRequest, "modelDirectory"> & {
    modelDirectory: AbsolutePath;
    options: Record<string, string>;
    startedAt: number;
    config: Config;
};

export function parseRequest(value: unknown, modelRoot: AbsolutePath): ParsedRequest {
    const startedAt = Date.now();
    if (!value || typeof value !== "object") throw new TranscriptionFailure({ kind: "transcription-invalid-request" });
    const request = value as Record<string, unknown>;
    if (request.executer !== "sherpa-onnx" && request.executer !== "whisper.cpp") {
        throw new TranscriptionFailure({ kind: "transcription-unknown-executer", executer: String(request.executer) });
    }
    for (const key of ["backendDirectory", "modelDirectory", "mediaPath"] as const) {
        if (typeof request[key] !== "string" || !request[key].trim() || request[key].includes("\0")) {
            throw new TranscriptionFailure({ kind: "transcription-empty-path", field: key });
        }
    }
    if (typeof request.params !== "string") throw new TranscriptionFailure({ kind: "transcription-params-text" });
    if (typeof request.mediaDuration !== "number" || !Number.isFinite(request.mediaDuration) || request.mediaDuration < 0) {
        throw new TranscriptionFailure({ kind: "transcription-invalid-request" });
    }
    let params: unknown;
    try {
        params = JSON.parse(request.params);
    }
    catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new TranscriptionFailure({ kind: "transcription-invalid-json", diagnostic: error.message }, { cause: error });
    }
    if (!params || typeof params !== "object" || Array.isArray(params)) {
        throw new TranscriptionFailure({ kind: "transcription-params-object" });
    }
    for (const [key, value] of Object.entries(params)) {
        if (!key || key.includes("\0")) throw new TranscriptionFailure({ kind: "transcription-invalid-option", option: key });
        if (typeof value !== "string") throw new TranscriptionFailure({ kind: "transcription-param-value" });
        if (value.includes("\0")) throw new TranscriptionFailure({ kind: "transcription-param-null" });
    }
    return {
        executer: request.executer,
        backendDirectory: request.backendDirectory as string,
        modelDirectory: resolveFilePath(modelRoot, request.modelDirectory as string),
        mediaPath: filePath(request.mediaPath),
        mediaDuration: request.mediaDuration,
        params: request.params,
        options: params as Record<string, string>,
        startedAt,
        config: {
            executer: request.executer,
            backendDirectory: request.backendDirectory as string,
            modelDirectory: request.modelDirectory as string,
            params: { ...params as Record<string, string> }
        }
    };
}