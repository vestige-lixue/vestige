import { mkdir, open, realpath } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { type Documentation, parseDocumentLink } from "../../shared/documentation";
import { type AbsolutePath } from "../../shared/util/path";
import { containsPath, parseAbsolutePath, isSystemError } from "../util/file";
import { errorCode, writeFileAtomic } from "../util/fs";
import { VestigeErrors } from "../../shared/failure";

const documentNames = ["README.en.md", "README.zh-cn.md", "params.en.md", "params.zh-cn.md"] as const;
const maximumBytes = 1024 * 1024;

async function readBounded(path: string): Promise<Buffer> {
    const file = await open(path, "r");
    try {
        const stat = await file.stat();
        if (!stat.isFile()) throw new VestigeErrors({ kind: "documentation-file", reason: "not-file", path });
        if (stat.size > maximumBytes) throw new VestigeErrors({ kind: "documentation-file", reason: "too-large", path, limitMiB: 1 });
        const bytes = Buffer.alloc(maximumBytes + 1);
        let length = 0;
        while (length < bytes.length) {
            const { bytesRead } = await file.read(bytes, length, bytes.length - length, null);
            if (!bytesRead) break;
            length += bytesRead;
        }
        if (length > maximumBytes) throw new VestigeErrors({ kind: "documentation-file", reason: "too-large", path, limitMiB: 1 });
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
        throw new VestigeErrors({ kind: "documentation-invalid-request", reason: "path" });
    }
    const actualRoot = parseAbsolutePath(await realpath(root));
    const actual = parseAbsolutePath(await realpath(normalized));
    if (!containsPath(actualRoot, actual)) throw new VestigeErrors({ kind: "documentation-invalid-request", reason: "path" });
    return normalized;
}

async function readFile(root: AbsolutePath, path: string): Promise<Documentation> {
    try {
        const checked = await documentPath(root, path);
        return { path: checked, content: (await readBounded(checked)).toString("utf8").replace(/^\uFEFF/, "") };
    }
    catch (error) {
        if (!isSystemError(error)) throw error;
        throw new VestigeErrors({ kind: "documentation-file", reason: errorCode(error) === "ENOENT" ? "missing" : "read", path, diagnostic: error.message }, { cause: error });
    }
}

export async function readDocumentation(root: AbsolutePath, kind: unknown, language: unknown): Promise<Documentation> {
    if (kind !== "guide" && kind !== "params") throw new VestigeErrors({ kind: "documentation-invalid-request", reason: "kind" });
    const locale = typeof language === "string" ? language.toLowerCase() : "";
    if (locale !== "en" && locale !== "zh-cn") throw new VestigeErrors({ kind: "documentation-invalid-request", reason: "language" });
    return readFile(root, join(root, `${kind === "guide" ? "README" : "params"}.${locale}.md`));
}

export async function readDocumentationLink(root: AbsolutePath, from: unknown, href: unknown): Promise<Documentation> {
    if (typeof from !== "string" || typeof href !== "string") throw new VestigeErrors({ kind: "documentation-invalid-request", reason: "link" });
    const link = parseDocumentLink(href);
    if (!link || link.kind !== "local") throw new VestigeErrors({ kind: "documentation-invalid-request", reason: "link" });
    try {
        await documentPath(root, from);
    }
    catch (error) {
        if (!isSystemError(error)) throw error;
        throw new VestigeErrors({ kind: "documentation-file", reason: errorCode(error) === "ENOENT" ? "missing" : "read", path: from, diagnostic: error.message }, { cause: error });
    }
    return readFile(root, link.path ? resolve(dirname(from), link.path) : from);
}