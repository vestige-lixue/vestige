import { join, relative } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, filePath, resolveFilePath } from "../util/file";
import { type TranscriptionRequest } from "../../shared/transcription/executer";
import { TranscriptionError } from "./failure";

export type ParsedRequest = Omit<TranscriptionRequest, "modelDirectory"> & {
    modelDirectory: AbsolutePath;
    options: Record<string, unknown>;
};

export function parseRequest(value: unknown, modelRoot: AbsolutePath): ParsedRequest {
    if (!value || typeof value !== "object") throw new TranscriptionError({ kind: "transcription-invalid-request" });
    const request = value as Record<string, unknown>;
    if (request.executer !== "sherpa-onnx" && request.executer !== "whisper.cpp") {
        throw new TranscriptionError({ kind: "transcription-unknown-executer", executer: String(request.executer) });
    }
    for (const key of ["modelDirectory", "mediaPath"] as const) {
        if (typeof request[key] !== "string" || !request[key].trim() || request[key].includes("\0")) {
            throw new TranscriptionError({ kind: "transcription-empty-path", field: key });
        }
    }
    if (typeof request.params !== "string") throw new TranscriptionError({ kind: "transcription-params-text" });
    let params: unknown;
    try {
        params = JSON.parse(request.params);
    }
    catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new TranscriptionError({ kind: "transcription-invalid-json", diagnostic: error.message }, { cause: error });
    }
    if (!params || typeof params !== "object" || Array.isArray(params)) {
        throw new TranscriptionError({ kind: "transcription-params-object" });
    }
    return {
        executer: request.executer,
        modelDirectory: resolveFilePath(modelRoot, request.modelDirectory as string),
        mediaPath: filePath(request.mediaPath),
        params: request.params,
        options: params as Record<string, unknown>
    };
}

export function argumentValue(value: unknown): string {
    const result = typeof value === "string" ? value : JSON.stringify(value);
    if (result === undefined) throw new TranscriptionError({ kind: "transcription-param-value" });
    if (result.includes("\0")) throw new TranscriptionError({ kind: "transcription-param-null" });
    return result;
}

export function optionName(key: string): string {
    const name = key.replace(/^-+/, "");
    if (!name || /[\s=\0]/.test(name)) throw new TranscriptionError({ kind: "transcription-invalid-option", option: key });
    return name;
}

export function modelPath(value: string, modelDirectory: AbsolutePath): string {
    const absolute = resolveFilePath(modelDirectory, value);
    if (!containsPath(modelDirectory, absolute)) return absolute;
    return join("models", relative(modelDirectory, absolute));
}