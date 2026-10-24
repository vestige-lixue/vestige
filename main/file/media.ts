import { isExpectedFailure } from "../../shared/failure";
import { open } from "node:fs/promises";
import { validMediaHash, type MediaCheckResult } from "../../shared/media/check";
import { getFileName, type AbsolutePath } from "../../shared/util/path";
import { parseAbsolutePath, isSystemError } from "../util/file";
import { probeMedia } from "./probe";
import { fileOperationFailure } from "../util/fs";
import { hashMedia } from "./hash";

export async function readMedia(
    input: unknown, reference: unknown, runtimeDirectory: AbsolutePath, signal: AbortSignal
): Promise<MediaCheckResult> {
    try {
        const path = parseAbsolutePath(input);
        if (reference !== null && (typeof reference !== "object" || !reference || !("size" in reference) || typeof reference.size !== "number" || !Number.isSafeInteger(reference.size) || reference.size < 0 || !("hash" in reference) || !validMediaHash(reference.hash))) {
            return { status: "unreadable", error: { kind: "media-invalid-reference" } };
        }
        signal.throwIfAborted();
        const file = await open(path, "r");
        try {
            signal.throwIfAborted();
            const before = await file.stat();
            if (!before.isFile()) return { status: "unreadable", error: { kind: "media-not-file" } };
            if (reference && before.size !== reference.size) return { status: "changed", error: { kind: "media-size-changed" } };
            const hash = await hashMedia(file, before.size, signal);
            if (hash === null) return { status: "changed", error: { kind: "media-changed-during-read" } };
            if (reference && hash !== reference.hash) return { status: "changed", error: { kind: "media-hash-changed" } };
            signal.throwIfAborted();
            const probe = await probeMedia(path, runtimeDirectory, signal);
            if (probe.status !== "ready") return probe;
            const after = await file.stat();
            const currentFile = await open(path, "r");
            try {
                // Compare handle stats consistently: path stat can report a different device ID on Windows.
                const current = await currentFile.stat();
                if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs
                    || current.dev !== after.dev || current.ino !== after.ino
                    || current.size !== after.size || current.mtimeMs !== after.mtimeMs || current.ctimeMs !== after.ctimeMs) {
                    return { status: "changed", error: { kind: "media-changed-during-read" } };
                }
                signal.throwIfAborted();
                return { status: "ready", media: { path, name: getFileName(path), size: before.size, hash, ...probe.metadata } };
            }
            finally {
                await currentFile.close();
            }
        }
        finally {
            await file.close();
        }
    }
    catch (error) {
        if (signal.aborted) return { status: "cancelled", error: { kind: "media-cancelled" } };
        if (isExpectedFailure(error)) return { status: "unreadable", error: error.failure };
        if (!isSystemError(error)) throw error;
        const code = error.code;
        return code === "ENOENT" || code === "ENOTDIR"
            ? { status: "missing", error: { kind: "media-missing" } }
            : { status: "unreadable", error: fileOperationFailure(error, "read", typeof input === "string" ? input : null) };
    }
}