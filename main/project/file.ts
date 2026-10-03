import { randomUUID } from "node:crypto";
import { open, readFile, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { type Project } from "../../shared/project/Project";
import { type AbsolutePath } from "../../shared/util/path";
import { type GetProjectResult, type SaveProjectResult } from "../../shared/project/file";
import { validateProject } from "./validate";
import { errorMessage, filePath } from "../util/file";

const pendingWritesQueue = new Map<string, Promise<SaveProjectResult>>();

export async function getProject(path: unknown): Promise<GetProjectResult> {
    try {
        const text = await readFile(filePath(path), "utf8");
        const project: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
        validateProject(project);
        return { success: true, project };
    }
    catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

async function writeProject(path: AbsolutePath, text: string): Promise<SaveProjectResult> {
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    try {
        const existing = await stat(path).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
            return null;
        });
        if (existing && !existing.isFile()) throw new Error("The project path must refer to a file.");
        const handle = await open(temporary, "wx", existing?.mode);
        try {
            await handle.writeFile(text, "utf8");
            await handle.sync();
        }
        finally {
            await handle.close();
        }
        await rename(temporary, path);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: errorMessage(error) };
    }
    finally {
        await rm(temporary, { force: true }).catch(() => {});
    }
}

export async function saveProject(path: unknown, project: Project): Promise<SaveProjectResult> {
    try {
        const normalized = filePath(path);
        validateProject(project);
        // Capture before waiting, so a queued write cannot observe later mutations.
        const text = JSON.stringify(project, null, 4);
        // Case folding only serializes potentially aliasing writes; keep the actual path unchanged.
        const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
        const previous = pendingWritesQueue.get(key);
        const write = (previous ?? Promise.resolve()).then(() => writeProject(normalized, text));
        pendingWritesQueue.set(key, write);
        try {
            return await write;
        }
        finally {
            if (pendingWritesQueue.get(key) === write) pendingWritesQueue.delete(key);
        }
    }
    catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}