import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { errorCode } from "../util/fs";

export async function listDirectories(root: AbsolutePath): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true }).catch((error: unknown) => {
        if (errorCode(error) === "ENOENT") return [];
        throw error;
    });
    const directories = await Promise.all(entries.filter(entry => !entry.name.startsWith(".download-")).map(async entry => {
        if (entry.isDirectory()) return entry.name;
        if (entry.isSymbolicLink() && await stat(join(root, entry.name)).then(info => info.isDirectory()).catch(() => false)) return entry.name;
        return null;
    }));
    return directories.filter((name): name is string => name !== null).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}