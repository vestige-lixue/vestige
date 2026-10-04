import { randomUUID } from "node:crypto";
import { open, readFile, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { type Project } from "../../shared/project/Project";
import { type AbsolutePath } from "../../shared/util/path";
import { type GetProjectResult, type SaveProjectResult } from "../../shared/project/file";
import { ProjectValidationError, validateProject } from "./validate";
import { filePath, InvalidPathError, isSystemError } from "../util/file";

const pendingWritesQueue = new Map<string, Promise<SaveProjectResult>>();

export async function getProject(path: unknown): Promise<GetProjectResult> {
    const normalized = filePath(path);
    try {
        const text = await readFile(normalized, "utf8");
        let project: unknown;
        try {
            project = JSON.parse(text.replace(/^\uFEFF/, ""));
        }
        catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
            throw new ProjectValidationError(error.message, { cause: error });
        }
        validateProject(project);
        return { success: true, project };
    }
    catch (error) {
        console.error("Could not open project:", error);
        if (error instanceof ProjectValidationError || isSystemError(error)) return { success: false, error: error.message };
        throw error;
    }
}

async function writeProject(path: AbsolutePath, text: string): Promise<SaveProjectResult> {
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    try {
        const existing = await stat(path).catch((error: unknown) => {
            if (!isSystemError(error) || error.code !== "ENOENT") throw error;
            return null;
        });
        if (existing && !existing.isFile()) throw new InvalidPathError("The project path must refer to a file.");
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
    finally {
        await rm(temporary, { force: true }).catch(error => {
            console.warn("Could not remove project temporary file:", temporary, error);
        });
    }
}

export async function saveProject(path: unknown, project: Project): Promise<SaveProjectResult> {
    const normalized = filePath(path);
    try {
        validateProject(project);
        // Capture before waiting, so a queued write cannot observe later mutations.
        const text = JSON.stringify(project, null, 4);
        // Case folding only serializes potentially aliasing writes; keep the actual path unchanged.
        const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
        const previous = pendingWritesQueue.get(key);
        const performWrite = (): Promise<SaveProjectResult> => writeProject(normalized, text);
        const write = (previous ?? Promise.resolve()).then(performWrite, performWrite);
        pendingWritesQueue.set(key, write);
        try {
            return await write;
        }
        finally {
            if (pendingWritesQueue.get(key) === write) pendingWritesQueue.delete(key);
        }
    }
    catch (error) {
        console.error("Could not save project:", error);
        if (error instanceof ProjectValidationError || error instanceof InvalidPathError || isSystemError(error)) {
            return { success: false, error: error.message };
        }
        throw error;
    }
}