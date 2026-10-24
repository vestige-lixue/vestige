import { mkdir, open, realpath } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { type Documentation, parseDocumentLink } from "../../shared/documentation";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, parseAbsolutePath } from "../util/file";
import { errorCode, writeFileAtomic } from "../util/fs";

const documentNames = ["README.en.md", "README.zh-cn.md", "params.en.md", "params.zh-cn.md"] as const;
const maximumBytes = 1024 * 1024;

async function readBounded(path: string): Promise<Buffer> {
    const file = await open(path, "r");
    try {
        const stat = await file.stat();
        if (!stat.isFile()) throw new Error(`Documentation is not a regular file: ${path}`);
        if (stat.size > maximumBytes) throw new Error(`Documentation exceeds the 1 MiB limit: ${path}`);
        const bytes = Buffer.alloc(maximumBytes + 1);
        let length = 0;
        while (length < bytes.length) {
            const { bytesRead } = await file.read(bytes, length, bytes.length - length, null);
            if (!bytesRead) break;
            length += bytesRead;
        }
        if (length > maximumBytes) throw new Error(`Documentation exceeds the 1 MiB limit: ${path}`);
        return bytes.subarray(0, length);
    }
    finally {
        await file.close();
    }
}

export async function initializeDocumentation(root: AbsolutePath, source: AbsolutePath): Promise<void> {
    await mkdir(root, { recursive: true });
    for (const name of documentNames) {
        const template = await readBounded(join(source, name));
        await writeFileAtomic(join(root, name), template, { sync: false, mode: undefined });
    }
}

async function documentPath(root: AbsolutePath, path: string): Promise<AbsolutePath> {
    const normalized = parseAbsolutePath(path);
    if (!containsPath(root, normalized) || extname(normalized).toLowerCase() !== ".md") {
        throw new Error(`Documentation must be a Markdown file inside the user data directory: ${path}`);
    }
    const actualRoot = parseAbsolutePath(await realpath(root));
    const actual = parseAbsolutePath(await realpath(normalized));
    if (!containsPath(actualRoot, actual)) throw new Error(`Documentation is outside the user data directory: ${path}`);
    return normalized;
}

async function readFile(root: AbsolutePath, path: string): Promise<Documentation> {
    try {
        const checked = await documentPath(root, path);
        return { path: checked, content: (await readBounded(checked)).toString("utf8").replace(/^\uFEFF/, "") };
    }
    catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
        throw new Error(`Documentation was not found: ${path}`);
    }
}

export async function readDocumentation(root: AbsolutePath, kind: unknown, language: unknown): Promise<Documentation> {
    if (kind !== "guide" && kind !== "params") throw new Error("Unsupported documentation kind.");
    const locale = typeof language === "string" ? language.toLowerCase() : "";
    if (locale !== "en" && locale !== "zh-cn") throw new Error("Unsupported documentation language.");
    return readFile(root, join(root, `${kind === "guide" ? "README" : "params"}.${locale}.md`));
}

export async function readDocumentationLink(root: AbsolutePath, from: unknown, href: unknown): Promise<Documentation> {
    if (typeof from !== "string" || typeof href !== "string") throw new Error("Invalid documentation link.");
    const link = parseDocumentLink(href);
    if (!link || link.kind !== "local") throw new Error("Invalid local documentation link.");
    await documentPath(root, from);
    return readFile(root, link.path ? resolve(dirname(from), link.path) : from);
}