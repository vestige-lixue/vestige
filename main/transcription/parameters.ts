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
    if (!value || typeof value !== "object") throw new TranscriptionError("A transcription request is required.");
    const request = value as Record<string, unknown>;
    if (request.executer !== "sherpa-onnx" && request.executer !== "whisper.cpp") {
        throw new TranscriptionError("Unknown executer: " + String(request.executer));
    }
    for (const key of ["modelDirectory", "mediaPath"]) {
        if (typeof request[key] !== "string" || !request[key].trim() || request[key].includes("\0")) {
            throw new TranscriptionError(key + " must be a non-empty path.");
        }
    }
    if (typeof request.params !== "string") throw new TranscriptionError("Parameters must be JSON text.");
    let params: unknown;
    try {
        params = JSON.parse(request.params);
    }
    catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new TranscriptionError(error.message, { cause: error });
    }
    if (!params || typeof params !== "object" || Array.isArray(params)) {
        throw new TranscriptionError("Parameters must be a JSON object.");
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
    if (result === undefined) throw new TranscriptionError("Parameter values must be JSON values.");
    if (result.includes("\0")) throw new TranscriptionError("Parameter values must not contain null characters.");
    return result;
}

export function optionName(key: string): string {
    const name = key.replace(/^-+/, "");
    if (!name || /[\s=\0]/.test(name)) throw new TranscriptionError("Invalid option name: " + key);
    return name;
}

export function modelPath(value: string, modelDirectory: AbsolutePath): string {
    const absolute = resolveFilePath(modelDirectory, value);
    if (!containsPath(modelDirectory, absolute)) return absolute;
    return join("models", relative(modelDirectory, absolute));
}