import { copyFile, mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, parseAbsolutePath, isSystemError } from "../util/file";
import { fileOperationFailure, lstatOrNull } from "../util/fs";
import { type AppPaths } from "../paths";
import { type DownloadSource, type DownloadReporter, type DownloadTransfer } from "./types";
import { prepareArchive } from "./archive";
import { DownloadCleanupError, removeDownloadStaging } from "./cleanup";
import { downloadFiles } from "./files";
import { installRuntimes } from "./runtimes";
import { toFailureInfo, VestigeErrors, type FailureInfo } from "../../shared/failure";

async function assertAbsent(path: string): Promise<void> {
    if (!await lstatOrNull(path)) return;
    throw new VestigeErrors({ kind: "download-conflict", scope: "destination", reason: "exists", path });
}

// A completed install may return a cleanup warning; operation failures reject.
export async function installDownload(
    source: DownloadSource,
    paths: Pick<AppPaths, "runtimeDirectory" | "runtimeCacheDirectory"> & { rootDirectory: AbsolutePath },
    transfer: DownloadTransfer,
    reporter: DownloadReporter,
    signal: AbortSignal
): Promise<FailureInfo | null> {
    const { rootDirectory: root, runtimeDirectory, runtimeCacheDirectory } = paths;
    const target = parseAbsolutePath(join(root, source.id));
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(source.id) || target === root || !containsPath(root, target)) throw new Error("Invalid download destination.");
    await mkdir(root, { recursive: true });
    signal.throwIfAborted();
    await assertAbsent(target);
    const staging = parseAbsolutePath(await mkdtemp(join(root, ".download-")));
    let installed = false;
    let failure: { cause: unknown } | null = null;
    try {
        reporter.append(`Preparing ${source.name}\n`);
        const payload = await source.resolve(signal);
        signal.throwIfAborted();
        if (payload.runtimes?.length && (source.kind !== "backend" || !payload.archive)) throw new Error("Runtime dependencies require a backend archive.");
        const files = await downloadFiles(payload.files, staging, transfer, reporter, signal);
        signal.throwIfAborted();
        let prepared = staging;
        if (payload.archive) {
            const archive = files.find(file => file.destination === join(staging, payload.archive!.filename));
            if (!archive?.sha256) throw new Error("A verified archive is required for backend installation.");
            prepared = await prepareArchive(archive.destination, staging, payload.archive.programs, runtimeDirectory, reporter, signal, { exclude: payload.archive.exclude });
            for (const file of payload.files.filter(file => file.destination !== payload.archive!.filename)) {
                const destination = join(prepared, file.destination);
                await mkdir(dirname(destination), { recursive: true });
                await copyFile(join(staging, file.destination), destination);
            }
        }
        if (payload.runtimes?.length) await installRuntimes(payload.runtimes, { runtimeDirectory, runtimeCacheDirectory }, staging, prepared, transfer, reporter, signal);
        await writeFile(join(prepared, "NOTICE"), payload.notice, "utf8");
        await writeFile(join(prepared, "download.json"), JSON.stringify({
            kind: source.kind, id: source.id, files: payload.files, runtimes: payload.runtimes, downloadedAt: new Date().toISOString()
        }, null, 4), "utf8");
        await assertAbsent(target);
        signal.throwIfAborted();
        await rename(prepared, target);
        installed = true;
        reporter.append(`Saved to ${target}\n`);
    }
    catch (cause) {
        failure = { cause: isSystemError(cause) ? new VestigeErrors(fileOperationFailure(cause, "access", cause.path ?? target), { cause }) : cause };
    }
    // Delete only our generated staging directory, never an installed package.
    try {
        await removeDownloadStaging(root, staging);
    }
    catch (error) {
        const cleanup = new DownloadCleanupError(staging, installed, error, failure ? toFailureInfo(failure.cause) : null);
        if (failure) throw cleanup;
        return cleanup.failure;
    }
    if (failure) throw failure.cause;
    return null;
}