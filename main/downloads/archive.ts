import { chmod, copyFile, lstat, mkdir, readdir, realpath } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, filePath } from "../util/file";
import { findExecutable, runProcess } from "../util/process";
import { type DownloadReporter } from "./types";
import { fileHash, linkOrCopy } from "./files";

export function validateArchiveEntries(output: string): void {
    for (const entry of output.split(/\r?\n/).filter(Boolean)) {
        const path = entry.replaceAll("\\", "/");
        if (path.startsWith("/") || path.includes(":") || path.split("/").includes("..")) {
            throw new Error(`Unsafe archive entry: ${entry}`);
        }
    }
}

export async function filesIn(directory: AbsolutePath, boundary = directory): Promise<AbsolutePath[]> {
    const files: AbsolutePath[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = filePath(join(directory, entry.name));
        if (entry.isDirectory()) files.push(...await filesIn(path, boundary));
        else if (entry.isFile() || entry.isSymbolicLink()) {
            const target = filePath(await realpath(path));
            if (!containsPath(boundary, target) || !(await lstat(target)).isFile()) throw new Error(`Unsupported archive link: ${path}`);
            files.push(path);
        }
        else throw new Error(`Unsupported archive entry: ${path}`);
    }
    return files;
}

export async function prepareArchive(archive: AbsolutePath, staging: AbsolutePath, programs: string[], runtimeDirectory: AbsolutePath, reporter: DownloadReporter, signal: AbortSignal, selection: { libraries?: boolean; exclude?: string[] } = {}): Promise<AbsolutePath> {
    if (!programs.length || [...programs, ...selection.exclude ?? []].some(program => !program || basename(program) !== program || /[\\/:]/.test(program))) throw new Error("Invalid required archive filenames.");
    const required = new Set(programs.map(program => process.platform === "win32" ? program.toLowerCase() : program));
    const excluded = new Set((selection.exclude ?? []).map(name => process.platform === "win32" ? name.toLowerCase() : name));
    if ([...required].some(name => excluded.has(name))) throw new Error("Required archive file is excluded.");
    const zip = /\.(?:zip|whl)$/i.test(archive) && process.platform !== "win32";
    const tool = await findExecutable(runtimeDirectory, "archive", zip ? "unzip" : "tar");
    const listing = await runProcess(tool, zip ? ["-Z1", archive] : ["-tf", archive], staging, signal);
    validateArchiveEntries(listing.stdout);
    const unpacked = filePath(join(staging, "unpacked"));
    const ready = filePath(join(staging, "ready"));
    await mkdir(unpacked);
    await mkdir(ready);
    reporter.append(`Extracting ${basename(archive)}\n`);
    reporter.progress(null);
    await runProcess(tool, zip ? ["-q", archive, "-d", unpacked] : ["-xf", archive, "-C", unpacked], staging, signal,
        (_stream, text) => reporter.append(text));
    const copied = new Map<string, AbsolutePath>();
    const targets = new Map<string, AbsolutePath>();
    for (const file of await filesIn(unpacked)) {
        signal.throwIfAborted();
        const name = basename(file);
        const parts = relative(unpacked, file).split(/[\\/]/);
        if (parts.some(part => /^(?:licen[sc]es?|copying|notices?|copyright|authors)(?:$|[._-])/i.test(part))) {
            const destination = join(ready, "licenses", ...parts);
            await mkdir(dirname(destination), { recursive: true });
            await copyFile(file, destination);
        }
        const key = process.platform === "win32" ? name.toLowerCase() : name;
        if (excluded.has(key) || !required.has(key) && (selection.libraries === false || !/\.(?:dll|dylib|so(?:\.[\d.]+)?|metallib)$/i.test(name))) continue;
        const previous = copied.get(key);
        if (previous) {
            const [previousHash, currentHash] = await Promise.all([fileHash(previous, signal), fileHash(file, signal)]);
            if (previousHash !== currentHash) throw new Error(`Conflicting backend filename: ${name}`);
            continue;
        }
        copied.set(key, file);
        const target = await realpath(file);
        const destination = filePath(join(ready, name));
        const existing = targets.get(target);
        if (existing) await linkOrCopy(existing, destination);
        else {
            await copyFile(file, destination);
            targets.set(target, destination);
        }
        if (process.platform !== "win32") await chmod(join(ready, name), 0o755);
    }
    for (const program of programs) {
        if (!copied.has(process.platform === "win32" ? program.toLowerCase() : program)) throw new Error(`Archive does not contain ${program}.`);
    }
    return ready;
}