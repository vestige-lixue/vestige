import { randomUUID } from "node:crypto";
import { type Stats } from "node:fs";
import { lstat, open, rename, rm, stat, type FileHandle } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { type FailureInfo, type FileOperation } from "../../shared/failure";

export function fileOperationFailure(error: NodeJS.ErrnoException, operation: FileOperation, path: string | null): FailureInfo {
    return { kind: "file-operation-failed", operation, path, diagnostic: error.message };
}

export function errorCode(error: unknown): string | undefined {
    return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

export async function statOrNull(path: string): Promise<Stats | null> {
    return stat(path).catch((error: unknown) => {
        if (errorCode(error) === "ENOENT") return null;
        throw error;
    });
}

export async function lstatOrNull(path: string): Promise<Stats | null> {
    return lstat(path).catch((error: unknown) => {
        if (errorCode(error) === "ENOENT") return null;
        throw error;
    });
}

// A comparison key only; callers retain the original path for filesystem access.
export function pathKey(path: string, platform: NodeJS.Platform = process.platform): string {
    return platform === "win32" ? path.toLowerCase() : path;
}

export async function writeFileAtomic(path: string, content: string | Uint8Array, options: { sync: boolean; mode: number | undefined }): Promise<void> {
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    let handle: FileHandle | undefined;
    let created = false;
    try {
        handle = await open(temporary, "wx", options.mode);
        created = true;
        await handle.writeFile(content, "utf8");
        if (options.sync) await handle.sync();
        await handle.close();
        handle = undefined;
        await rename(temporary, path);
        created = false;
    }
    finally {
        // Cleanup is best effort and must not replace the original operation error.
        await handle?.close().catch(error => console.warn("Could not close temporary file:", temporary, error));
        if (created) await rm(temporary, { force: true }).catch(error => console.warn("Could not remove temporary file:", temporary, error));
    }
}