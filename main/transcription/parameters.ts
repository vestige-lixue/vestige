import { isAbsolute, join, relative, resolve } from "node:path";
import { type TranscriptionRequest } from "../../shared/transcription/executer";

export type ParsedRequest = TranscriptionRequest & { options: Record<string, unknown> };

export function parseRequest(value: unknown): ParsedRequest {
    if (!value || typeof value !== "object") throw new Error("A transcription request is required.");
    const request = value as Record<string, unknown>;
    if (request.executer !== "sherpa-onnx" && request.executer !== "whisper.cpp") {
        throw new Error("Unknown executer: " + String(request.executer));
    }
    for (const key of ["modelDirectory", "mediaPath"]) {
        if (typeof request[key] !== "string" || !request[key].trim()) {
            throw new Error(key + " must be a non-empty path.");
        }
    }
    if (typeof request.params !== "string") throw new Error("Parameters must be JSON text.");
    const params: unknown = JSON.parse(request.params);
    if (!params || typeof params !== "object" || Array.isArray(params)) {
        throw new Error("Parameters must be a JSON object.");
    }
    return {
        executer: request.executer,
        modelDirectory: request.modelDirectory as string,
        mediaPath: request.mediaPath as string,
        params: request.params,
        options: params as Record<string, unknown>
    };
}

export function argumentValue(value: unknown): string {
    const result = typeof value === "string" ? value : JSON.stringify(value);
    if (result === undefined) throw new Error("Parameter values must be JSON values.");
    return result;
}

export function optionName(key: string): string {
    const name = key.replace(/^-+/, "");
    if (!name || /[\s=\0]/.test(name)) throw new Error("Invalid option name: " + key);
    return name;
}

export function modelPath(value: string, modelDirectory: string): string {
    const absolute = resolve(modelDirectory, value);
    const child = relative(modelDirectory, absolute);
    if (child === ".." || child.startsWith("..\\") || child.startsWith("../") || isAbsolute(child)) return absolute;
    return join("models", child);
}