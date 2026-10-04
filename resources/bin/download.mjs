import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { chmod, copyFile, lstat, mkdir, mkdtemp, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = await realpath(dirname(fileURLToPath(import.meta.url)));
const names = ["ffmpeg", "sherpa-onnx", "whisper.cpp"];

function options(args) {
    const result = { platform: process.platform, arch: process.arch, only: null, dryRun: false, help: false };
    for (let i = 0; i < args.length; i++) {
        const argument = args[i];
        if (argument === "--dry-run") result.dryRun = true;
        else if (argument === "--help") result.help = true;
        else if (argument === "--platform" || argument === "--arch" || argument === "--only") {
            const value = args[++i];
            if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
            result[argument.slice(2)] = value;
        }
        else throw new Error(`Unknown argument: ${argument}`);
    }
    if (result.only !== null && !names.includes(result.only)) throw new Error(`Unknown program package: ${result.only}`);
    return result;
}

async function request(url, timeout = 30_000) {
    const headers = { "User-Agent": "Vestige-native-downloader" };
    if (new URL(url).hostname === "api.github.com") {
        headers.Accept = "application/vnd.github+json";
        if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    return response;
}

async function release(repo, endpoint = "releases/latest") {
    return (await request(`https://api.github.com/repos/${repo}/${endpoint}`)).json();
}

function packageFor(name, repo, info, assetName, programs) {
    const asset = info.assets.find(asset => asset.name === assetName);
    if (!asset) throw new Error(`${repo} ${info.tag_name} does not publish ${assetName}. No binaries were replaced.`);
    if (!/^sha256:[a-f\d]{64}$/i.test(asset.digest ?? "")) throw new Error(`${assetName} has no upstream SHA-256 digest.`);
    return { name, repo, tag: info.tag_name, page: info.html_url, asset, programs };
}

async function resolveDownloads(platform, arch, selected) {
    if (!["win32", "linux"].includes(platform) || !["x64", "arm64"].includes(arch)) {
        throw new Error(`No complete prebuilt CLI set is configured for ${platform}/${arch}. `
            + "The official whisper.cpp macOS release contains an XCFramework, not whisper-cli; prepare native CLI files manually.");
    }
    const suffix = platform === "win32" ? ".exe" : "";
    return Promise.all(selected.map(async name => {
        if (name === "ffmpeg") {
            const info = await release("BtbN/FFmpeg-Builds");
            const target = (platform === "win32" ? "win" : "linux") + (arch === "x64" ? "64" : "arm64");
            return packageFor(name, "BtbN/FFmpeg-Builds", info,
                `ffmpeg-master-latest-${target}-lgpl-shared.${platform === "win32" ? "zip" : "tar.xz"}`, ["ffmpeg" + suffix, "ffprobe" + suffix]);
        }
        if (name === "sherpa-onnx") {
            const info = await release("k2-fsa/sherpa-onnx");
            const target = platform === "win32" ? `win-${arch}-shared-MT-Release-no-tts`
                : arch === "x64" ? "linux-x64-shared-no-tts" : "linux-aarch64-shared-cpu";
            return packageFor(name, "k2-fsa/sherpa-onnx", info,
                `sherpa-onnx-${info.tag_name}-${target}.tar.bz2`, ["sherpa-onnx-offline" + suffix]);
        }
        const releases = await release("ggml-org/whisper.cpp", "releases?per_page=20");
        const asset = platform === "win32" ? arch === "x64" ? "whisper-bin-x64.zip" : "whisper-bin-win-cpu-arm64.zip"
            : `whisper-bin-ubuntu-${arch}.tar.gz`;
        // Semantic releases may contain only source; the newest official build carries the CLI archives.
        const info = releases.filter(info => !info.draft)
            .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
            .find(info => info.assets.some(item => item.name === asset));
        if (!info) throw new Error(`No ${asset} in the latest 20 official whisper.cpp releases. No binaries were replaced.`);
        return packageFor(name, "ggml-org/whisper.cpp", info, asset, ["whisper-cli" + suffix]);
    }));
}

async function download(asset, path) {
    const response = await request(asset.browser_download_url, 15 * 60_000);
    const hash = createHash("sha256");
    let size = 0;
    const measure = new Transform({
        transform(chunk, _encoding, done) {
            hash.update(chunk);
            size += chunk.length;
            done(null, chunk);
        }
    });
    await pipeline(Readable.fromWeb(response.body), measure, createWriteStream(path, { flags: "wx" }));
    const digest = "sha256:" + hash.digest("hex");
    if (size !== asset.size || digest !== asset.digest.toLowerCase()) throw new Error(`Download verification failed: ${asset.name}`);
}

function inside(parent, path) {
    const child = relative(parent, resolve(path));
    if (!child || child === ".." || child.startsWith("..\\") || child.startsWith("../") || isAbsolute(child)) {
        throw new Error(`Path is outside the expected directory: ${path}`);
    }
}

async function extract(archive, directory) {
    const zip = archive.endsWith(".zip") && process.platform !== "win32";
    const executable = zip ? "unzip" : "tar";
    const { stdout } = await run(executable, zip ? ["-Z1", archive] : ["-tf", archive], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    for (const entry of stdout.split(/\r?\n/).filter(Boolean)) {
        const path = entry.replaceAll("\\", "/");
        if (path.startsWith("/") || /^[a-z]:/i.test(path) || path.split("/").includes("..")) {
            throw new Error(`Unsafe archive entry: ${entry}`);
        }
    }
    await mkdir(directory);
    await run(executable, zip ? ["-q", archive, "-d", directory] : ["-xf", archive, "-C", directory], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
}

async function filesIn(directory, boundary = directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await filesIn(path, boundary));
        else {
            if (entry.isSymbolicLink()) {
                const target = await realpath(path);
                inside(boundary, target);
                if (!(await lstat(target)).isFile()) throw new Error(`Unsupported archive link: ${path}`);
            }
            files.push(path);
        }
    }
    return files;
}

async function prepare(item, work, platform, arch) {
    const archive = join(work, item.asset.name);
    console.log(`Downloading ${item.name}: ${item.asset.name}`);
    await download(item.asset, archive);
    const unpacked = join(work, item.name + "-archive");
    await extract(archive, unpacked);
    const target = join(work, "ready", item.name);
    await mkdir(target, { recursive: true });
    const copied = new Set();
    let notices = 0;
    for (const file of await filesIn(unpacked)) {
        const name = basename(file);
        const parts = relative(unpacked, file).split(/[\\/]/);
        const notice = parts.some(part => /^(?:licen[sc]es?|copying|notices?|copyright|authors)(?:$|[._-])/i.test(part));
        if (notice) {
            const destination = join(target, "licenses", ...parts);
            await mkdir(dirname(destination), { recursive: true });
            await copyFile(file, destination);
            notices++;
        }
        if (!item.programs.includes(name) && !/\.(?:dll|dylib|so(?:\.[\d.]+)?|metallib)$/i.test(name)) continue;
        if (copied.has(name)) throw new Error(`Duplicate runtime filename in ${item.asset.name}: ${name}`);
        copied.add(name);
        await copyFile(file, join(target, name));
        if (platform !== "win32") await chmod(join(target, name), 0o755);
    }
    for (const name of item.programs) if (!copied.has(name)) throw new Error(`${item.asset.name} does not contain ${name}.`);
    if (item.name === "ffmpeg" && platform === process.platform && arch === process.arch) {
        for (const name of item.programs) {
            await run(join(target, name), ["-version"], { windowsHide: true, timeout: 15_000, maxBuffer: 1024 * 1024 });
        }
    }
    if (item.name !== "ffmpeg") {
        const license = await request(`https://raw.githubusercontent.com/${item.repo}/${encodeURIComponent(item.tag)}/LICENSE`);
        await mkdir(join(target, "licenses"), { recursive: true });
        await writeFile(join(target, "licenses", "LICENSE.txt"), await license.text());
        notices++;
    }
    if (!notices) throw new Error(`No license or distribution notices found in ${item.asset.name}.`);
    await writeFile(join(target, "download.json"), JSON.stringify({
        platform, arch, release: item.tag, releaseURL: item.page, asset: item.asset.name,
        url: item.asset.browser_download_url, sha256: item.asset.digest, downloadedAt: new Date().toISOString()
    }, null, 4));
}

async function replaceAll(work, selected) {
    const previous = join(work, "previous");
    await mkdir(previous);
    const moved = [];
    const installed = [];
    try {
        for (const name of selected) {
            const target = join(root, name);
            inside(root, target);
            const info = await lstat(target).catch(error => {
                if (error.code === "ENOENT") return null;
                throw error;
            });
            if (info) {
                if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Refusing to replace a non-directory or symbolic link: ${target}`);
                await rename(target, join(previous, name));
                moved.push(name);
            }
            await rename(join(work, "ready", name), target);
            installed.push(name);
        }
    }
    catch (error) {
        for (const name of installed.reverse()) {
            const target = join(root, name);
            inside(root, target);
            await rm(target, { recursive: true, force: true });
        }
        for (const name of moved.reverse()) await rename(join(previous, name), join(root, name));
        throw error;
    }
}

async function main() {
    const settings = options(process.argv.slice(2));
    if (settings.help) {
        console.log("Usage: node resources/bin/download.mjs [--dry-run] [--only ffmpeg|sherpa-onnx|whisper.cpp] [--platform win32|linux] [--arch x64|arm64]\n"
            + "Downloads the latest available CPU CLI packages, shared libraries and licenses.\n"
            + "Replaces the selected program directories only after all selected packages are ready; defaults to all three.");
        return;
    }
    const selected = settings.only === null ? names : [settings.only];
    const packages = await resolveDownloads(settings.platform, settings.arch, selected);
    for (const item of packages) console.log(`${item.name}: ${item.tag}\n  ${item.asset.name}\n  ${item.asset.browser_download_url}`);
    if (settings.dryRun) return;
    const work = await mkdtemp(join(root, ".download-"));
    let installed = false;
    try {
        for (const item of packages) await prepare(item, work, settings.platform, settings.arch);
        await replaceAll(work, selected);
        installed = true;
        console.log(`Installed native programs for ${settings.platform}/${settings.arch}.`);
    }
    finally {
        inside(root, work);
        const backups = await readdir(join(work, "previous")).catch(error => {
            if (error.code === "ENOENT") return [];
            throw error;
        });
        if (!installed && backups.length) console.error(`Previous programs are preserved for recovery in ${join(work, "previous")}.`);
        else await rm(work, { recursive: true, force: true });
    }
}

await main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});