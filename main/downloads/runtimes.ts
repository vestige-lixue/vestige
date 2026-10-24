import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, filePath } from "../util/file";
import { filesIn, prepareArchive } from "./archive";
import { downloadFiles, fileHash, linkOrCopy } from "./files";
import { type DownloadReporter, type DownloadTransfer, type RuntimeDownload } from "./types";

type RuntimeManifest = { archive: string; files: { path: string; size: number; sha256: string }[] };
const pending = new Map<string, Promise<void>>();

function waitForRuntime(completion: Promise<void>, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const abort = (): void => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        void completion.then(() => {
            signal.removeEventListener("abort", abort);
            resolve();
        });
    });
}

async function readRuntime(directory: AbsolutePath, runtime: RuntimeDownload, signal: AbortSignal): Promise<RuntimeManifest | null> {
    const exists = await lstat(directory).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
    });
    if (!exists) return null;
    if (!exists.isDirectory() || exists.isSymbolicLink()) throw new Error(`Invalid runtime cache: ${directory}`);
    const manifest: RuntimeManifest = JSON.parse(await readFile(join(directory, "runtime.json"), "utf8"));
    if (manifest.archive !== runtime.file.sha256 || !Array.isArray(manifest.files) || !manifest.files.length
        || runtime.libraries.some(name => !manifest.files.some(file => file.path === name))) throw new Error(`Incomplete runtime cache: ${directory}`);
    for (const file of manifest.files) {
        signal.throwIfAborted();
        const path = filePath(join(directory, file.path));
        if (path === directory || !containsPath(directory, path) || !/^[a-f\d]{64}$/.test(file.sha256)) throw new Error(`Invalid runtime cache entry: ${file.path}`);
        const info = await lstat(path);
        if (!info.isFile() || info.size !== file.size || await fileHash(path, signal) !== file.sha256) throw new Error(`Corrupt runtime cache: ${path}`);
    }
    return manifest;
}

async function prepareRuntime(runtime: RuntimeDownload, cache: AbsolutePath, staging: AbsolutePath, runtimeDirectory: AbsolutePath, transfer: DownloadTransfer, reporter: DownloadReporter, signal: AbortSignal): Promise<RuntimeManifest> {
    if (!/^[a-f\d]{64}$/.test(runtime.file.sha256) || !Number.isSafeInteger(runtime.file.size) || runtime.file.size <= 0) throw new Error("Invalid runtime archive metadata.");
    const directory = filePath(join(cache, runtime.file.sha256));
    // Serialize shared components across simultaneous backend downloads. Cancellation
    // of a waiter leaves the owner running; cancellation of the owner permits a retry.
    while (pending.has(directory)) await waitForRuntime(pending.get(directory)!, signal);
    signal.throwIfAborted();
    let release!: () => void;
    pending.set(directory, new Promise<void>(resolve => release = resolve));
    try {
        reporter.append(`Checking runtime ${runtime.name}\n`);
        const cached = await readRuntime(directory, runtime, signal);
        if (cached) {
            reporter.append(`Reusing ${runtime.name}\n`);
            return cached;
        }
        const working = filePath(join(staging, runtime.file.sha256));
        await mkdir(working);
        reporter.append(`Downloading runtime ${runtime.name}\n`);
        const [archive] = await downloadFiles([runtime.file], working, transfer, reporter, signal);
        const prepared = await prepareArchive(archive.destination, working, runtime.libraries, runtimeDirectory, reporter, signal, { libraries: false });
        const manifest: RuntimeManifest = { archive: runtime.file.sha256, files: [] };
        for (const path of await filesIn(prepared)) {
            signal.throwIfAborted();
            manifest.files.push({ path: relative(prepared, path).replaceAll("\\", "/"), size: (await lstat(path)).size, sha256: await fileHash(path, signal) });
        }
        if (!manifest.files.some(file => file.path.startsWith("licenses/"))) throw new Error(`Runtime archive has no license: ${runtime.name}`);
        await writeFile(join(prepared, "runtime.json"), JSON.stringify(manifest, null, 4), "utf8");
        await mkdir(cache, { recursive: true });
        signal.throwIfAborted();
        try {
            await rename(prepared, directory);
        }
        catch (error) {
            if (!["EEXIST", "ENOTEMPTY", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
            // Another application process may have completed the same component.
            const existing = await readRuntime(directory, runtime, signal);
            if (!existing) throw error;
            return existing;
        }
        return manifest;
    }
    finally {
        pending.delete(directory);
        release();
    }
}

export async function installRuntimes(runtimes: RuntimeDownload[], root: AbsolutePath, staging: AbsolutePath, prepared: AbsolutePath, runtimeDirectory: AbsolutePath, transfer: DownloadTransfer, reporter: DownloadReporter, signal: AbortSignal): Promise<void> {
    const cache = filePath(join(root, ".runtimes"));
    for (const runtime of runtimes) {
        const manifest = await prepareRuntime(runtime, cache, staging, runtimeDirectory, transfer, reporter, signal);
        for (const file of manifest.files) {
            signal.throwIfAborted();
            const source = filePath(join(cache, runtime.file.sha256, file.path));
            const destination = filePath(join(prepared, file.path.startsWith("licenses/") ? `licenses/${runtime.file.sha256}/${file.path.slice(9)}` : file.path));
            await mkdir(dirname(destination), { recursive: true });
            try {
                // Hard links keep each backend independently usable while storing
                // an exact runtime version only once on supported filesystems.
                await linkOrCopy(source, destination);
            }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
                if (!(await lstat(destination)).isFile() || await fileHash(destination, signal) !== file.sha256) throw new Error(`Conflicting runtime filename: ${file.path}`);
            }
        }
    }
}