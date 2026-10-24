import { constants, createReadStream } from "node:fs";
import { copyFile, link, lstat, mkdir, open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, parseAbsolutePath } from "../util/file";
import { errorCode, pathKey } from "../util/fs";
import { type DownloadFile, type DownloadReporter, type DownloadTransfer } from "./types";
import { VestigeErrors } from "../../shared/failure";

export async function fileHash(file: AbsolutePath, signal: AbortSignal): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file, { signal })) hash.update(chunk);
    return hash.digest("hex");
}

export async function linkOrCopy(source: AbsolutePath, destination: AbsolutePath): Promise<void> {
    try {
        await link(source, destination);
    }
    catch (error) {
        if (!["EXDEV", "EPERM", "EACCES", "ENOTSUP", "ENOSYS", "EMLINK"].includes(errorCode(error) ?? "")) throw error;
        await copyFile(source, destination, constants.COPYFILE_EXCL);
    }
}

export async function downloadFiles(files: DownloadFile[], staging: AbsolutePath, transfer: DownloadTransfer, reporter: DownloadReporter, signal: AbortSignal): Promise<(DownloadFile & { destination: AbsolutePath })[]> {
    const downloads = files.map(file => {
        const destination = parseAbsolutePath(join(staging, file.destination));
        if (destination === staging || !containsPath(staging, destination)) throw new Error("Invalid download filename.");
        if (!["http:", "https:"].includes(new URL(file.url).protocol)) throw new Error("Invalid download URL.");
        if (file.sha256 !== undefined && !/^[a-f\d]{64}$/i.test(file.sha256)) throw new Error("Invalid download SHA-256.");
        return { ...file, destination };
    });
    if (!downloads.length) throw new Error("No files to download.");
    if (new Set(downloads.map(file => pathKey(file.destination))).size !== downloads.length) throw new Error("Duplicate download destination.");
    for (const file of downloads) await mkdir(dirname(file.destination), { recursive: true });
    reporter.progress(null);
    await transfer(downloads, staging, reporter, signal);
    for (const file of downloads) {
        signal.throwIfAborted();
        const info = await lstat(file.destination);
        if (!info.isFile() || info.size === 0) throw new VestigeErrors({ kind: "download-integrity", reason: "empty", file: file.destination });
        if (file.size !== undefined && info.size !== file.size) throw new VestigeErrors({ kind: "download-integrity", reason: "size", file: file.destination, expected: file.size, actual: info.size });
        if (file.sha256) {
            const actual = await fileHash(file.destination, signal);
            if (actual !== file.sha256.toLowerCase()) throw new VestigeErrors({ kind: "download-integrity", reason: "checksum", file: file.destination, expected: file.sha256, actual });
        }
        const input = await open(file.destination, "r");
        try {
            const prefix = Buffer.alloc(512);
            const { bytesRead } = await input.read(prefix, 0, prefix.length, 0);
            if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(prefix.toString("utf8", 0, bytesRead))) throw new VestigeErrors({ kind: "download-integrity", reason: "html", file: file.destination });
        }
        finally {
            await input.close();
        }
    }
    return downloads;
}