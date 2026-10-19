import { chmod, copyFile, lstat, mkdir, readdir, realpath } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, filePath } from "../util/file";
import { findExecutable, runProcess } from "../util/process";
import { type DownloadReporter } from "./types";

export function validateArchiveEntries(output: string): void {
    for (const entry of output.split(/\r?\n/).filter(Boolean)) {
        const path = entry.replaceAll("\\", "/");
        if (path.startsWith("/") || path.includes(":") || path.split("/").includes("..")) {
            throw new Error(`Unsafe archive entry: ${entry}`);
        }
    }
}

async function filesIn(directory: AbsolutePath, boundary = directory): Promise<AbsolutePath[]> {
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

async function fileHash(file: AbsolutePath, signal: AbortSignal): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file, { signal })) hash.update(chunk);
    return hash.digest("hex");
}

export async function prepareArchive(archive: AbsolutePath, staging: AbsolutePath, program: string, runtimeDirectory: AbsolutePath, reporter: DownloadReporter, signal: AbortSignal): Promise<AbsolutePath> {
    if (!program || basename(program) !== program || /[\\/:]/.test(program)) throw new Error("Invalid backend program name.");
    const zip = archive.endsWith(".zip") && process.platform !== "win32";
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
    for (const file of await filesIn(unpacked)) {
        signal.throwIfAborted();
        const name = basename(file);
        const parts = relative(unpacked, file).split(/[\\/]/);
        if (parts.some(part => /^(?:licen[sc]es?|copying|notices?|copyright|authors)(?:$|[._-])/i.test(part))) {
            const destination = join(ready, "licenses", ...parts);
            await mkdir(dirname(destination), { recursive: true });
            await copyFile(file, destination);
        }
        if (name !== program && !/\.(?:dll|dylib|so(?:\.[\d.]+)?|metallib)$/i.test(name)) continue;
        const key = process.platform === "win32" ? name.toLowerCase() : name;
        const previous = copied.get(key);
        if (previous) {
            const [previousHash, currentHash] = await Promise.all([fileHash(previous, signal), fileHash(file, signal)]);
            if (previousHash !== currentHash) throw new Error(`Conflicting backend filename: ${name}`);
            continue;
        }
        copied.set(key, file);
        await copyFile(file, join(ready, name));
        if (process.platform !== "win32") await chmod(join(ready, name), 0o755);
    }
    if (!copied.has(process.platform === "win32" ? program.toLowerCase() : program)) throw new Error(`Archive does not contain ${program}.`);
    return ready;
}