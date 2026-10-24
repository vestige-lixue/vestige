import { rm } from "node:fs/promises";
import { basename } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath } from "../util/file";
import { VestigeErrors } from "../../shared/failure";

export class DownloadCleanupError extends VestigeErrors {
    constructor(readonly root: AbsolutePath, readonly staging: AbsolutePath, readonly installed: boolean, cause: unknown) {
        super({ kind: "download-cleanup", directory: staging, installed, diagnostic: cause instanceof Error ? cause.message : String(cause) }, { cause });
    }

    async retry(): Promise<void> {
        await removeDownloadStaging(this.root, this.staging);
    }
}

export async function removeDownloadStaging(root: AbsolutePath, staging: AbsolutePath): Promise<void> {
    if (staging === root || !containsPath(root, staging) || !basename(staging).startsWith(".download-")) throw new Error("Invalid temporary download directory.");
    await rm(staging, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}