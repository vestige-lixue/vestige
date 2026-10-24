import { readdir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, isSystemError, parseAbsolutePath } from "../util/file";
import { fileOperationFailure, lstatOrNull, pathKey } from "../util/fs";
import { type DownloadRoots } from "./types";
import { toFailureInfo, VestigeErrors, type FailureInfo } from "../../shared/failure";

export class DownloadCleanupError extends VestigeErrors {
    constructor(directory: AbsolutePath, installed: boolean, cause: unknown, operation: FailureInfo | null = null) {
        super({ kind: "download-cleanup", directory, installed, operation, diagnostic: cause instanceof Error ? cause.message : String(cause) }, { cause });
    }
}

export async function removeDownloadStaging(root: AbsolutePath, staging: AbsolutePath): Promise<void> {
    if (pathKey(dirname(staging)) !== pathKey(root) || !containsPath(root, staging) || !basename(staging).startsWith(".download-")) throw new Error("Invalid temporary download directory.");
    const directory = await lstatOrNull(root);
    if (!directory) return;
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error("Invalid download root directory.");
    const temporary = await lstatOrNull(staging);
    if (!temporary) return;
    if (!temporary.isDirectory() || temporary.isSymbolicLink()) throw new Error("Invalid temporary download directory.");
    await rm(staging, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

// Run only after acquiring the profile lock, before registering download IPCs.
export async function cleanupDownloadOrphans(roots: DownloadRoots, report: (failure: FailureInfo) => void): Promise<void> {
    for (const root of Object.values(roots)) {
        let entries: string[];
        try {
            const directory = await lstatOrNull(root);
            if (!directory || !directory.isDirectory() || directory.isSymbolicLink()) continue;
            entries = await readdir(root);
        }
        catch (error) {
            report(isSystemError(error) ? fileOperationFailure(error, "inspect", root) : toFailureInfo(error));
            continue;
        }
        for (const name of entries) {
            if (!name.startsWith(".download-")) continue;
            const staging = parseAbsolutePath(join(root, name));
            try {
                const directory = await lstatOrNull(staging);
                if (!directory || !directory.isDirectory() || directory.isSymbolicLink()) continue;
                await removeDownloadStaging(root, staging);
            }
            catch (error) {
                report(new DownloadCleanupError(staging, false, error).failure);
            }
        }
    }
}