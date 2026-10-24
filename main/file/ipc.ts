import { type DirectoryListResult, type FilePathResult } from "../../shared/util/file";
import { VestigeErrors, isExpectedFailure, type OperationResult } from "../../shared/failure";
import { selectMediaPath, selectMediaPaths, selectDirectory } from "../ui/fileDialogs";
import { shell, type BrowserWindow } from "electron";
import { dirname } from "node:path";
import { fileChannels } from "../../shared/ipc";
import { type DownloadKind } from "../../shared/downloads";
import { type MediaCheckResult, type MediaURLResult } from "../../shared/media/check";
import { type AppPaths } from "../paths";
import { parseAbsolutePath, isSystemError } from "../util/file";
import { fileOperationFailure } from "../util/fs";
import { handle, listen } from "../util/ipc";
import { findExecutable } from "../util/process";
import { validationLoad, validationPlayback } from "./validation";
import { readMedia } from "./media";
import { getMediaURL, releaseMediaURL, releaseMediaURLs } from "./source";
import { listDirectories } from "./directories";

export function registerFileIPCs(window: BrowserWindow, paths: Pick<AppPaths, "runtimeDirectory" | "modelDirectory" | "backendDirectory">): void {
    const { runtimeDirectory, modelDirectory, backendDirectory } = paths;
    const contents = window.webContents;
    const directoryRoots = { backend: backendDirectory, model: modelDirectory };
    const checks = new Map<string, AbortController>();
    let generation = 0;
    const cancelAll = (): void => {
        generation++;
        validationPlayback(false);
        for (const controller of checks.values()) controller.abort();
        void releaseMediaURLs();
    };
    contents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) cancelAll();
    });
    contents.on("render-process-gone", cancelAll);
    contents.once("destroyed", cancelAll);
    handle(contents, fileChannels.normalize, (path: unknown): FilePathResult => {
        try {
            return { success: true, path: parseAbsolutePath(path) };
        }
        catch (error) {
            if (isExpectedFailure(error)) return { success: false, error: error.failure };
            throw error;
        }
    });
    handle(contents, fileChannels.readMedia, async (id: unknown, path: unknown, reference: unknown): Promise<MediaCheckResult> => {
        if (typeof id !== "string" || !id || id.length > 128 || checks.has(id)) return { status: "unreadable", error: { kind: "media-invalid-check-id" } };
        const controller = new AbortController();
        checks.set(id, controller);
        try {
            return await readMedia(path, reference, runtimeDirectory, controller.signal);
        }
        finally {
            checks.delete(id);
        }
    });
    listen(contents, fileChannels.cancelMediaRead, (id: unknown) => {
        if (typeof id !== "string") return;
        checks.get(id)?.abort();
    });
    handle(contents, fileChannels.validationLoad, validationLoad);
    listen(contents, fileChannels.validationPlayback, (playing: unknown) => {
        if (typeof playing === "boolean") validationPlayback(playing);
        else console.warn("Invalid media validation playback flag.");
    });
    handle(contents, fileChannels.getMediaURL, async (path: unknown): Promise<MediaURLResult> => {
        const current = generation;
        const result = await getMediaURL(path);
        if (result.status === "ready" && current !== generation) {
            await releaseMediaURL(result.id);
            return { status: "unreadable", error: { kind: "media-source-invalidated" } };
        }
        return result;
    });
    handle(contents, fileChannels.releaseMediaURL, (id: unknown) => releaseMediaURL(id));
    handle(contents, fileChannels.selectMediaPath, (path: unknown) => selectMediaPath(window, path));
    handle(contents, fileChannels.selectMediaPaths, () => selectMediaPaths(window));
    handle(contents, fileChannels.selectDirectory, (value: unknown) => {
        const kind = directoryKind(value);
        return selectDirectory(window, kind, directoryRoots[kind]);
    });
    handle(contents, fileChannels.listDirectories, async (value: unknown): Promise<DirectoryListResult> => {
        try {
            return { success: true, directories: await listDirectories(directoryRoots[directoryKind(value)]) };
        }
        catch (error) {
            if (isExpectedFailure(error)) return { success: false, error: error.failure };
            if (isSystemError(error)) return { success: false, error: fileOperationFailure(error, "inspect", error.path ?? null) };
            throw error;
        }
    });
    handle(contents, fileChannels.openFFmpegDirectory, async (): Promise<OperationResult> => {
        let directory: string;
        try {
            directory = dirname(await findExecutable(runtimeDirectory, "ffmpeg", "ffmpeg"));
        }
        catch (error) {
            if (isExpectedFailure(error)) return { success: false, error: error.failure };
            throw error;
        }
        try {
            const diagnostic = await shell.openPath(directory);
            return diagnostic ? { success: false, error: { kind: "file-operation-failed", operation: "open-directory", path: directory, diagnostic } } : { success: true };
        }
        catch (error) {
            return { success: false, error: { kind: "file-operation-failed", operation: "open-directory", path: directory, diagnostic: error instanceof Error ? error.message : String(error) } };
        }
    });
}

function directoryKind(value: unknown): DownloadKind {
    if (value !== "model" && value !== "backend") throw new VestigeErrors({ kind: "file-invalid-directory" });
    return value;
}