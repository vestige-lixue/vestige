import { posix, win32 } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { type MediaPathMode } from "../../shared/project/file";
import { resolveFilePath, storedFilePath } from "../util/file";
import { VestigeErrors } from "../../shared/failure";

export function resolveMediaPath(path: string, directory?: AbsolutePath): AbsolutePath {
    if (path.startsWith("/") || win32.isAbsolute(path)) return storedFilePath(path);
    if (!directory || !path || path.includes("\0") || win32.parse(path).root) {
        throw new VestigeErrors({ kind: "path-not-absolute" });
    }
    return resolveFilePath(directory, path, directory.startsWith("/") ? "linux" : "win32");
}

export function serializeMediaPath(path: AbsolutePath, directory: AbsolutePath, mode: MediaPathMode): string {
    if (mode === "absolute" || path.startsWith("/") !== directory.startsWith("/")) return path;
    const syntax = directory.startsWith("/") ? posix : win32;
    // Different drives or UNC shares cannot share a relative path.
    if (syntax === win32 && syntax.parse(path).root.toLowerCase() !== syntax.parse(directory).root.toLowerCase()) return path;
    const relative = syntax.relative(directory, path);
    if (!relative || syntax.isAbsolute(relative)) return path;
    if (mode === "project" && (relative === ".." || relative.startsWith(".." + syntax.sep))) return path;
    // Store portable separators without changing literal backslashes in POSIX filenames.
    if (syntax === win32) return relative.replaceAll("\\", "/");
    return win32.parse(relative).root ? `./${relative}` : relative;
}