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
const names = ["ffmpeg", "aria2", "vad"];

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
    if (result.only !== null && !names.includes(result.only)) throw new Error(`Unknown resource package: ${result.only}`);
    return result;
}

async function request(url, timeout = 30_000) {
    const headers = { "User-Agent": "Vestige-native-downloader" };
    if (new URL(url).hostname === "api.github.com") {
        headers.Accept = "application/vnd.github+json";
        if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw Object.assign(new Error(`${response.status} ${response.statusText}: ${url}`), { status: response.status });
    return response;
}

async function release(repo, endpoint = "releases/latest") {
    return (await request(`https://api.github.com/repos/${repo}/${endpoint}`)).json();
}

function releaseAsset(repo, info, assetName) {
    const asset = info.assets.find(asset => asset.name === assetName);
    if (!asset) throw new Error(`${repo} ${info.tag_name} does not publish ${assetName}. No binaries were replaced.`);
    if (!/^sha256:[a-f\d]{64}$/i.test(asset.digest ?? "")) throw new Error(`${assetName} has no upstream SHA-256 digest.`);
    return asset;
}

function packageFor(name, repo, info, assetName, programs) {
    return {
        name, repo, tag: info.tag_name, page: info.html_url, programs,
        downloads: [{ asset: releaseAsset(repo, info, assetName) }],
        licenseURL: name === "ffmpeg" ? null : `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(info.tag_name)}/LICENSE`
    };
}

async function resolveDownloads(platform, arch, selected) {
    if (!["win32", "linux", "darwin"].includes(platform) || !["x64", "arm64"].includes(arch)) {
        throw new Error(`No complete prebuilt CLI set is configured for ${platform}/${arch}.`);
    }
    const suffix = platform === "win32" ? ".exe" : "";
    return Promise.all(selected.map(async name => {
        if (name === "vad") {
            const repo = "snakers4/silero-vad", tag = "v6.2", assetName = "silero_vad.onnx";
            return {
                name, repo, tag, page: `https://github.com/${repo}/tree/${tag}`,
                programs: [], resources: [assetName], licenseURL: null,
                downloads: [{ asset: {
                    name: assetName, size: 2327524,
                    digest: "sha256:1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3",
                    browser_download_url: `https://raw.githubusercontent.com/${repo}/${tag}/src/silero_vad/data/${assetName}`
                }, destination: assetName }]
            };
        }
        if (name === "aria2") {
            if (platform !== "win32" || arch !== "x64") {
                throw new Error(`No verified aria2 archive is configured for ${platform}/${arch}. `
                    + "Supply aria2c and its distribution notices in resources/bin/aria2, then prepare the other packages with --only.");
            }
            // This official release predates GitHub asset digests. Pin its SHA-256 from the winget manifest.
            const repo = "aria2/aria2", tag = "release-1.37.0", assetName = "aria2-1.37.0-win-64bit-build1.zip";
            return {
                name, repo, tag, page: `https://github.com/${repo}/releases/tag/${tag}`,
                programs: ["aria2c.exe"], licenseURL: null,
                downloads: [{ asset: {
                    name: assetName, size: 2475379,
                    digest: "sha256:67d015301eef0b612191212d564c5bb0a14b5b9c4796b76454276a4d28d9b288",
                    browser_download_url: `https://github.com/${repo}/releases/download/${tag}/${assetName}`
                } }]
            };
        }
        if (name === "ffmpeg") {
            if (platform === "darwin") {
                const repo = "eugeneware/ffmpeg-static";
                const info = await release(repo);
                const programs = ["ffmpeg", "ffprobe"];
                const files = [
                    ...programs.map(program => [program + "-darwin-" + arch, program]),
                    [`darwin-${arch}.LICENSE`, "licenses/LICENSE.txt"],
                    [`darwin-${arch}.README`, "licenses/README.txt"]
                ];
                return {
                    name, repo, tag: info.tag_name, page: info.html_url, programs, licenseURL: null,
                    downloads: files.map(([assetName, destination]) => ({ asset: releaseAsset(repo, info, assetName), destination }))
                };
            }
            const info = await release("BtbN/FFmpeg-Builds");
            const target = (platform === "win32" ? "win" : "linux") + (arch === "x64" ? "64" : "arm64");
            return packageFor(name, "BtbN/FFmpeg-Builds", info,
                `ffmpeg-master-latest-${target}-lgpl-shared.${platform === "win32" ? "zip" : "tar.xz"}`, ["ffmpeg" + suffix, "ffprobe" + suffix]);
        }
        throw new Error(`Unknown resource package: ${name}`);
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
    const unpacked = join(work, item.name + "-archive");
    const directFiles = item.downloads.every(file => file.destination);
    if (directFiles) await mkdir(unpacked);
    for (const { asset, destination } of item.downloads) {
        const path = join(work, asset.name);
        console.log(`Downloading ${item.name}: ${asset.name}`);
        await download(asset, path);
        if (destination) {
            const output = join(unpacked, destination);
            inside(unpacked, output);
            await mkdir(dirname(output), { recursive: true });
            await copyFile(path, output);
        }
        else await extract(path, unpacked);
    }
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
        const runtime = item.programs.includes(name) || /\.(?:dll|dylib|so(?:\.[\d.]+)?|metallib)$/i.test(name);
        if (!runtime && !item.resources?.includes(name)) continue;
        if (copied.has(name)) throw new Error(`Duplicate runtime filename in ${item.name}: ${name}`);
        copied.add(name);
        await copyFile(file, join(target, name));
        if (platform !== "win32" && runtime) await chmod(join(target, name), 0o755);
    }
    for (const name of [...item.programs, ...(item.resources ?? [])]) if (!copied.has(name)) throw new Error(`${item.name} does not contain ${name}.`);
    if (["ffmpeg", "aria2"].includes(item.name) && platform === process.platform && arch === process.arch) {
        for (const name of item.programs) {
            await run(join(target, name), [item.name === "aria2" ? "--version" : "-version"], { windowsHide: true, timeout: 15_000, maxBuffer: 1024 * 1024 });
        }
    }
    if (item.licenseURL) {
        const license = await request(item.licenseURL);
        await mkdir(join(target, "licenses"), { recursive: true });
        await writeFile(join(target, "licenses", "LICENSE.txt"), await license.text());
        notices++;
    }
    if (item.name === "vad") {
        // Keep the tracked notices when replacing the downloaded model directory.
        for (const name of ["LICENSE", "README.md"]) await copyFile(join(root, item.name, name), join(target, name));
        notices++;
    }
    if (!notices) throw new Error(`No license or distribution notices found in ${item.name}.`);
    await writeFile(join(target, "download.json"), JSON.stringify({
        platform, arch, release: item.tag, releaseURL: item.page,
        assets: item.downloads.map(({ asset, destination }) => ({ name: asset.name, url: asset.browser_download_url, sha256: asset.digest, destination })),
        downloadedAt: new Date().toISOString()
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
        console.log("Usage: node resources/bin/download.mjs [--dry-run] [--only ffmpeg|aria2|vad] [--platform win32|linux|darwin] [--arch x64|arm64]\n"
            + "Downloads media and download tools, the VAD model, shared libraries and licenses. Transcription backends are downloaded in the app.\n"
            + "Replaces the selected package directories only after all selected packages are ready; defaults to all three. aria2's verified archive is Windows x64 only.");
        return;
    }
    const selected = settings.only === null ? names : [settings.only];
    const packages = await resolveDownloads(settings.platform, settings.arch, selected);
    for (const item of packages) {
        console.log(`${item.name}: ${item.tag}`);
        for (const { asset } of item.downloads) console.log(`  ${asset.name}\n  ${asset.browser_download_url}`);
    }
    if (settings.dryRun) return;
    const work = await mkdtemp(join(root, ".download-"));
    let installed = false;
    try {
        for (const item of packages) await prepare(item, work, settings.platform, settings.arch);
        await replaceAll(work, selected);
        installed = true;
        console.log(`Installed bundled resources for ${settings.platform}/${settings.arch}.`);
    }
    finally {
        inside(root, work);
        const backups = await readdir(join(work, "previous")).catch(error => {
            if (error.code === "ENOENT") return [];
            throw error;
        });
        if (!installed && backups.length) console.error(`Previous packages are preserved for recovery in ${join(work, "previous")}.`);
        else await rm(work, { recursive: true, force: true });
    }
}

await main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});