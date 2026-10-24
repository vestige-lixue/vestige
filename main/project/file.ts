import { isExpectedFailure, VestigeErrors } from "../../shared/failure";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { type GetProjectResult, type SaveProjectResult, type CheckProjectFileResult, type MediaPathMode } from "../../shared/project/file";
import { parseProject } from "./validate";
import { parseAbsolutePath, isSystemError } from "../util/file";
import { fileOperationFailure, pathKey, statOrNull, writeFileAtomic } from "../util/fs";
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
            throw new VestigeErrors({ kind: "project-invalid-json", diagnostic: error.message }, { cause: error });
        }
        return { success: true, project: parseProject(project, parseAbsolutePath(dirname(normalized))) };
    }
    catch (error) {
        console.error("Could not open project:", path, error);
        if (isExpectedFailure(error)) return { success: false, error: error.failure };
        if (isSystemError(error)) return { success: false, error: fileOperationFailure(error, "read", typeof path === "string" ? path : null) };
        throw error;
    }
}

export async function checkProjectFile(path: unknown): Promise<CheckProjectFileResult> {
    try {
        const normalized = parseAbsolutePath(path);
        const existing = await statOrNull(normalized);
        if (existing && !existing.isFile()) throw new VestigeErrors({ kind: "project-path-not-file" });
        return { success: true, exists: existing !== null };
    }
    catch (error) {
        if (isExpectedFailure(error)) return { success: false, error: error.failure };
        if (isSystemError(error)) return { success: false, error: fileOperationFailure(error, "inspect", typeof path === "string" ? path : null) };
        throw error;
    }
}

async function writeProject(path: AbsolutePath, text: string): Promise<SaveProjectResult> {
    const existing = await statOrNull(path);
    if (existing && !existing.isFile()) throw new VestigeErrors({ kind: "project-path-not-file" });
    await writeFileAtomic(path, text, { sync: true, mode: existing?.mode });
    return { success: true };
}

export async function saveProject(path: unknown, project: unknown, compress = false, rememberPlaybackPosition = true, mediaPathMode: MediaPathMode = "project"): Promise<SaveProjectResult> {
    try {
        const normalized = parseAbsolutePath(path);
        const parsed = parseProject(project);
        const directory = parseAbsolutePath(dirname(normalized));
        // Capture before waiting, so a queued write cannot observe later mutations.
        // Only the disk snapshot uses relative paths; runtime media keeps absolute paths.
        const snapshot = {
            ...parsed,
            vestiges: parsed.vestiges.map(vestige => ({
                ...vestige,
                media: { ...vestige.media, path: serializeMediaPath(vestige.media.path, directory, mediaPathMode) },
                playbackPosition: rememberPlaybackPosition ? vestige.playbackPosition : 0
            }))
        };
        const text = JSON.stringify(snapshot, null, compress ? undefined : 4);
        // Case folding only serializes potentially aliasing writes; keep the actual path unchanged.
        const key = pathKey(normalized);
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
        if (isExpectedFailure(error)) return { success: false, error: error.failure };
        if (isSystemError(error)) return { success: false, error: fileOperationFailure(error, "write", typeof path === "string" ? path : null) };
        throw error;
    }
}