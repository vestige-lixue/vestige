import { VestigeErrors, toFailureInfo } from "../../shared/failure";
import { open } from "node:fs/promises";
import { type MediaCheckResult, type MediaReference } from "../../shared/media/check";
import { getFileName, type AbsolutePath } from "../../shared/util/path";
import { filePath, isSystemError } from "../util/file";
import { probeMedia } from "./probe";

export async function readMedia(
    input: unknown, reference: MediaReference | null, runtimeDirectory: AbsolutePath, signal: AbortSignal
): Promise<MediaCheckResult> {
    try {
        const path = filePath(input);
        if (reference !== null && (!reference || !Number.isSafeInteger(reference.size) || reference.size < 0 || !Number.isFinite(reference.mtimeMs))) {
            return { status: "unreadable", error: { kind: "media-invalid-reference" } };
        }
        signal.throwIfAborted();
        const file = await open(path, "r");
        try {
            signal.throwIfAborted();
            const before = await file.stat();
            if (!before.isFile()) return { status: "unreadable", error: { kind: "media-not-file" } };
            if (reference && before.size !== reference.size) return { status: "changed", error: { kind: "media-size-changed" } };
            if (reference && before.mtimeMs !== reference.mtimeMs) {
                return { status: "changed", error: { kind: "media-mtime-changed" } };
            }
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
                return { status: "ready", media: { path, name: getFileName(path), size: before.size, mtimeMs: before.mtimeMs, ...probe.metadata } };
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
        if (error instanceof VestigeErrors) return { status: "unreadable", error: error.failure };
        if (!isSystemError(error)) throw error;
        const code = error.code;
        return code === "ENOENT" || code === "ENOTDIR"
            ? { status: "missing", error: { kind: "media-missing" } }
            : { status: "unreadable", error: toFailureInfo(error) };
    }
}