import { toFailureInfo } from "../../shared/failure";
import { randomUUID } from "node:crypto";
import { open, readFile, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { type Project } from "../../shared/project/Project";
import { type AbsolutePath } from "../../shared/util/path";
import { type GetProjectResult, type SaveProjectResult, type MediaPathMode } from "../../shared/project/file";
import { ProjectValidationFailure, validateProject } from "./validate";
import { parseAbsolutePath, InvalidPathFailure, isSystemError } from "../util/file";
import { serializeMediaPath } from "./path";

const pendingWritesQueue = new Map<string, Promise<SaveProjectResult>>();

export async function getProject(path: unknown): Promise<GetProjectResult> {
    try {
        const normalized = parseAbsolutePath(path);
        const text = await readFile(normalized, "utf8");
        let project: unknown;
        try {
            project = JSON.parse(text.replace(/^\uFEFF/, ""));
        }
        catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
            throw new ProjectValidationFailure({ kind: "project-invalid-json", diagnostic: error.message }, { cause: error });
        }
        validateProject(project, parseAbsolutePath(dirname(normalized)));
        return { success: true, project };
    }
    catch (error) {
        console.error("Could not open project:", path, error);
        if (error instanceof ProjectValidationFailure || error instanceof InvalidPathFailure || isSystemError(error)) return { success: false, error: toFailureInfo(error) };
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
        if (existing && !existing.isFile()) throw new InvalidPathFailure({ kind: "project-path-not-file" });
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

export async function saveProject(path: unknown, project: Project, compress = false, rememberPlaybackPosition = true, mediaPathMode: MediaPathMode = "project"): Promise<SaveProjectResult> {
    try {
        const normalized = parseAbsolutePath(path);
        validateProject(project);
        const directory = parseAbsolutePath(dirname(normalized));
        // Capture before waiting, so a queued write cannot observe later mutations.
        // Only the disk snapshot uses relative paths; runtime media keeps absolute paths.
        const snapshot = {
            ...project,
            vestiges: project.vestiges.map(vestige => ({
                ...vestige,
                media: { ...vestige.media, path: serializeMediaPath(vestige.media.path, directory, mediaPathMode) },
                playbackPosition: rememberPlaybackPosition ? vestige.playbackPosition : 0
            }))
        };
        const text = JSON.stringify(snapshot, null, compress ? undefined : 4);
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
        console.error("Could not save project:", path, error);
        if (error instanceof ProjectValidationFailure || error instanceof InvalidPathFailure || isSystemError(error)) {
            return { success: false, error: toFailureInfo(error) };
        }
        throw error;
    }
}