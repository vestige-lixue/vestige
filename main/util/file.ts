import { posix, win32 } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function filePath(path: unknown, platform: NodeJS.Platform = process.platform): AbsolutePath {
    const syntax = platform === "win32" ? win32 : posix;
    if (typeof path !== "string" || path.includes("\0") || !syntax.isAbsolute(path)
        || (platform === "win32" && syntax.parse(path).root.length === 1)) {
        throw new Error("An absolute file path is required.");
    }
    // Windows paths rooted at '\' still depend on the current drive. Reject them
    // above so normalization never introduces a dependency on the working directory.
    return syntax.resolve(path) as AbsolutePath;
}

export function resolveFilePath(directory: AbsolutePath, path: string, platform: NodeJS.Platform = process.platform): AbsolutePath {
    const syntax = platform === "win32" ? win32 : posix;
    if (syntax.isAbsolute(path)) return filePath(path, platform);
    // A drive-relative path such as D:clip.wav can silently read that drive's cwd.
    if (syntax.parse(path).root) throw new Error("Relative file paths must not specify a drive.");
    return filePath(syntax.resolve(filePath(directory, platform), path), platform);
}

export function storedFilePath(path: string): AbsolutePath {
    // Projects can reference missing files or files from another operating system.
    return filePath(path, path.startsWith("/") ? "linux" : "win32");
}

export function containsPath(directory: AbsolutePath, path: AbsolutePath, platform: NodeJS.Platform = process.platform): boolean {
    const syntax = platform === "win32" ? win32 : posix;
    const child = syntax.relative(directory, path);
    // Lexical containment, including the directory itself; does not follow links.
    return child !== ".." && !child.startsWith(".." + syntax.sep) && !syntax.isAbsolute(child);
}