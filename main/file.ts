import { isAbsolute, resolve } from "node:path";

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function filePath(path: string): string {
    if (typeof path !== "string" || !isAbsolute(path) || path.includes("\0")) {
        throw new Error("An absolute file path is required.");
    }
    return resolve(path);
}