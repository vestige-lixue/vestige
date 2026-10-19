import { copyFile, lstat, mkdir, mkdtemp, open, rename, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, filePath } from "../util/file";
import { type DownloadSource, type DownloadReporter, type DownloadTransfer } from "./types";
import { prepareArchive } from "./archive";
import { DownloadCleanupError, removeDownloadStaging } from "./cleanup";

async function assertAbsent(path: string): Promise<void> {
    try {
        await lstat(path);
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
    }
    throw new Error(`Download directory already exists. Move it before downloading again: ${path}`);
}

export async function installDownload(
    source: DownloadSource,
    root: AbsolutePath,
    runtimeDirectory: AbsolutePath,
    transfer: DownloadTransfer,
    reporter: DownloadReporter,
    signal: AbortSignal
): Promise<void> {
    const target = filePath(join(root, source.id));
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(source.id) || target === root || !containsPath(root, target)) throw new Error("Invalid download destination.");
    await mkdir(root, { recursive: true });
    await assertAbsent(target);
    signal.throwIfAborted();
    const staging = filePath(await mkdtemp(join(root, ".download-")));
    let installed = false;
    let failure: { cause: unknown } | null = null;
    try {
        reporter.append(`Preparing ${source.name}\n`);
        const payload = await source.resolve(signal);
        signal.throwIfAborted();
        const files = payload.files.map(file => {
            const destination = filePath(join(staging, file.destination));
            if (destination === staging || !containsPath(staging, destination)) throw new Error("Invalid download filename.");
            if (!["http:", "https:"].includes(new URL(file.url).protocol)) throw new Error("Invalid download URL.");
            return { ...file, destination };
        });
        if (!files.length) throw new Error("No files to download.");
        if (new Set(files.map(file => file.destination.toLowerCase())).size !== files.length) throw new Error("Duplicate download destination.");
        for (const file of files) await mkdir(dirname(file.destination), { recursive: true });
        reporter.progress(null);
        await transfer(files, staging, reporter, signal);
        for (const file of files) {
            signal.throwIfAborted();
            const info = await lstat(file.destination);
            if (!info.isFile() || info.size === 0) throw new Error(`Incomplete download: ${file.destination}`);
            if (file.size !== undefined && info.size !== file.size) throw new Error(`Incorrect download size: ${file.destination}`);
            if (file.sha256) {
                const hash = createHash("sha256");
                for await (const chunk of createReadStream(file.destination)) {
                    signal.throwIfAborted();
                    hash.update(chunk);
                }
                if (hash.digest("hex") !== file.sha256.toLowerCase()) throw new Error(`SHA-256 mismatch: ${file.destination}`);
            }
            const input = await open(file.destination, "r");
            try {
                const prefix = Buffer.alloc(512);
                const { bytesRead } = await input.read(prefix, 0, prefix.length, 0);
                if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(prefix.toString("utf8", 0, bytesRead))) {
                    throw new Error(`Unexpected HTML response: ${file.destination}`);
                }
            }
            finally {
                await input.close();
            }
        }
        signal.throwIfAborted();
        let prepared = staging;
        if (payload.archive) {
            const archive = files.find(file => file.destination === join(staging, payload.archive!.filename));
            if (!archive?.sha256) throw new Error("A verified archive is required for backend installation.");
            prepared = await prepareArchive(archive.destination, staging, payload.archive.program, runtimeDirectory, reporter, signal);
            for (const file of payload.files.filter(file => file.destination !== payload.archive!.filename)) {
                const destination = join(prepared, file.destination);
                await mkdir(dirname(destination), { recursive: true });
                await copyFile(join(staging, file.destination), destination);
            }
        }
        await writeFile(join(prepared, "NOTICE"), payload.notice, "utf8");
        await writeFile(join(prepared, "download.json"), JSON.stringify({
            kind: source.kind, id: source.id, files: payload.files, downloadedAt: new Date().toISOString()
        }, null, 4), "utf8");
        await assertAbsent(target);
        signal.throwIfAborted();
        await rename(prepared, target);
        installed = true;
        reporter.append(`Saved to ${target}\n`);
    }
    catch (cause) {
        failure = { cause };
    }
    // Delete only our generated staging directory, never an installed package.
    try {
        await removeDownloadStaging(root, staging);
    }
    catch (error) {
        if (failure) reporter.append(`${failure.cause instanceof Error ? failure.cause.message : String(failure.cause)}\n`);
        throw new DownloadCleanupError(root, staging, installed, error);
    }
    if (failure) throw failure.cause;
}