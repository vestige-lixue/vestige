import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { type MediaCheckResult, type MediaReference } from "../../shared/media/check";
import { errorMessage, filePath } from "../util/file";

export async function readMedia(input: unknown, reference: MediaReference | null, signal: AbortSignal): Promise<MediaCheckResult> {
    if (reference !== null && (!reference || !Number.isSafeInteger(reference.size) || reference.size < 0 || typeof reference.hash !== "string")) {
        throw new Error("A media size and hash are required.");
    }
    try {
        signal.throwIfAborted();
        const path = filePath(input);
        const file = await open(path, "r");
        try {
            signal.throwIfAborted();
            const before = await file.stat();
            if (!before.isFile()) return { status: "unreadable", error: "该路径不是普通文件。" };
            if (reference && before.size !== reference.size) return { status: "changed", error: "文件大小与项目记录不一致。" };
            const hash = createHash("sha256");
            const stream = file.createReadStream({ highWaterMark: 1024 * 1024, autoClose: false, signal });
            for await (const chunk of stream) hash.update(chunk);
            signal.throwIfAborted();
            const after = await file.stat();
            const currentFile = await open(path, "r");
            try {
                // Compare handle stats consistently: path stat can report a different device ID on Windows.
                const current = await currentFile.stat();
                if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs
                    || current.dev !== after.dev || current.ino !== after.ino
                    || current.size !== after.size || current.mtimeMs !== after.mtimeMs || current.ctimeMs !== after.ctimeMs) {
                    return { status: "changed", error: "检查期间文件发生了变化，请重试。" };
                }
                signal.throwIfAborted();
                const fingerprint = hash.digest("hex");
                return !reference || fingerprint === reference.hash.toLowerCase()
                    ? { status: "available", path, size: before.size, hash: fingerprint }
                    : { status: "changed", error: "文件哈希与项目记录不一致。" };
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
        if (signal.aborted) throw error;
        const code = (error as NodeJS.ErrnoException).code;
        return code === "ENOENT" || code === "ENOTDIR"
            ? { status: "missing", error: "找不到此路径下的媒体文件，文件可能已移动或重命名。" }
            : { status: "unreadable", error: errorMessage(error) };
    }
}