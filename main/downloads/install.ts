import { copyFile, lstat, mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, parseAbsolutePath } from "../util/file";
import { type DownloadSource, type DownloadReporter, type DownloadTransfer, type DownloadPayload } from "./types";
import { filesIn, prepareArchive } from "./archive";
import { DownloadCleanupError, removeDownloadStaging } from "./cleanup";
import { downloadFiles, fileHash, linkOrCopy } from "./files";
import { installRuntimes } from "./runtimes";

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

async function canRepair(target: AbsolutePath, source: DownloadSource, payload: DownloadPayload): Promise<boolean> {
    const directory = await lstat(target).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
    });
    if (!directory) return false;
    if (source.kind !== "backend" || !payload.runtimes?.length || !payload.archive || !directory.isDirectory() || directory.isSymbolicLink()) {
        await assertAbsent(target);
        return false;
    }
    const receipt = JSON.parse(await readFile(join(target, "download.json"), "utf8")) as { kind?: string; id?: string; files?: DownloadPayload["files"] };
    const archive = payload.files.find(file => file.destination === payload.archive!.filename);
    if (receipt.kind !== source.kind || receipt.id !== source.id || !archive?.sha256
        || !receipt.files?.some(file => file.destination === archive.destination && file.sha256 === archive.sha256)) {
        throw new Error(`Existing backend does not match this release. Move it before downloading again: ${target}`);
    }
    for (const name of payload.archive.programs) {
        const info = await lstat(join(target, name));
        if (!info.isFile() || !info.size) throw new Error(`Existing backend is incomplete: ${name}`);
    }
    return true;
}

async function publishRepair(prepared: AbsolutePath, target: AbsolutePath, signal: AbortSignal): Promise<void> {
    const files = await filesIn(prepared);
    // Check every collision before changing the existing backend. In particular,
    // never overwrite a DLL that could be shared with another installation.
    for (const file of files) {
        signal.throwIfAborted();
        const destination = parseAbsolutePath(join(target, relative(prepared, file)));
        const existing = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return null;
            throw error;
        });
        if (existing && (!existing.isFile() || await fileHash(file, signal) !== await fileHash(destination, signal))) throw new Error(`Conflicting runtime file. Move the backend before downloading again: ${destination}`);
    }
    for (const file of files) {
        signal.throwIfAborted();
        const destination = parseAbsolutePath(join(target, relative(prepared, file)));
        await mkdir(dirname(destination), { recursive: true });
        try {
            await linkOrCopy(file, destination);
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await lstat(destination)).isFile()
                || await fileHash(file, signal) !== await fileHash(destination, signal)) throw error;
        }
    }
}

export async function installDownload(
    source: DownloadSource,
    root: AbsolutePath,
    runtimeDirectory: AbsolutePath,
    transfer: DownloadTransfer,
    reporter: DownloadReporter,
    signal: AbortSignal
): Promise<void> {
    const target = parseAbsolutePath(join(root, source.id));
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(source.id) || target === root || !containsPath(root, target)) throw new Error("Invalid download destination.");
    await mkdir(root, { recursive: true });
    signal.throwIfAborted();
    const staging = parseAbsolutePath(await mkdtemp(join(root, ".download-")));
    let installed = false;
    let failure: { cause: unknown } | null = null;
    try {
        reporter.append(`Preparing ${source.name}\n`);
        const payload = await source.resolve(signal);
        signal.throwIfAborted();
        if (payload.runtimes?.length && (source.kind !== "backend" || !payload.archive)) throw new Error("Runtime dependencies require a backend archive.");
        const repair = await canRepair(target, source, payload);
        const files = repair ? [] : await downloadFiles(payload.files, staging, transfer, reporter, signal);
        signal.throwIfAborted();
        let prepared = staging;
        if (repair) {
            reporter.append(`Completing runtime dependencies for ${target}\n`);
            prepared = parseAbsolutePath(join(staging, "ready"));
            await mkdir(prepared);
        }
        else if (payload.archive) {
            const archive = files.find(file => file.destination === join(staging, payload.archive!.filename));
            if (!archive?.sha256) throw new Error("A verified archive is required for backend installation.");
            prepared = await prepareArchive(archive.destination, staging, payload.archive.programs, runtimeDirectory, reporter, signal, { exclude: payload.archive.exclude });
            for (const file of payload.files.filter(file => file.destination !== payload.archive!.filename)) {
                const destination = join(prepared, file.destination);
                await mkdir(dirname(destination), { recursive: true });
                await copyFile(join(staging, file.destination), destination);
            }
        }
        if (payload.runtimes?.length) await installRuntimes(payload.runtimes, root, staging, prepared, runtimeDirectory, transfer, reporter, signal);
        if (repair) await publishRepair(prepared, target, signal);
        else {
            await writeFile(join(prepared, "NOTICE"), payload.notice, "utf8");
            await writeFile(join(prepared, "download.json"), JSON.stringify({
                kind: source.kind, id: source.id, files: payload.files, runtimes: payload.runtimes, downloadedAt: new Date().toISOString()
            }, null, 4), "utf8");
            await assertAbsent(target);
            signal.throwIfAborted();
            await rename(prepared, target);
        }
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