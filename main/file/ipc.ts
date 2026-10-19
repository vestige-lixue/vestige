import { type FilePathResult } from "../../shared/util/file";
import { VestigeErrors, toFailureInfo } from "../../shared/failure";
import { selectMediaPath, selectMediaPaths, selectDirectory } from "../ui/fileDialogs";
import { shell, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { dirname } from "node:path";
import { fileChannels } from "../../shared/ipc";
import { type DownloadKind } from "../../shared/downloads";
import { type MediaReference, type MediaCheckResult, type MediaURLResult } from "../../shared/media/check";
import { type AbsolutePath } from "../../shared/util/path";
import { filePath } from "../util/file";
import { findExecutable } from "../util/process";
import { readMedia } from "./media";
import { getMediaURL, releaseMediaURL, releaseMediaURLs } from "./source";
import { listDirectories } from "./directories";

export function registerFileIPCs(window: BrowserWindow, runtimeDirectory: AbsolutePath, modelDirectory: AbsolutePath, backendDirectory: AbsolutePath): void {
    const contents = window.webContents;
    const directoryRoots = { backend: backendDirectory, model: modelDirectory };
    const checks = new Map<string, AbortController>();
    let generation = 0;
    const checkSender = (event: IpcMainEvent | IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new VestigeErrors({ kind: "ipc-not-main-frame" });
    };
    const cancelAll = (): void => {
        generation++;
        for (const controller of checks.values()) controller.abort();
        void releaseMediaURLs();
    };
    contents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) cancelAll();
    });
    contents.on("render-process-gone", cancelAll);
    contents.once("destroyed", cancelAll);
    contents.ipc.handle(fileChannels.normalize, (event, path: unknown): FilePathResult => {
        checkSender(event);
        try {
            return { success: true, path: filePath(path) };
        }
        catch (error) {
            return { success: false, error: toFailureInfo(error) };
        }
    });
    contents.ipc.handle(fileChannels.readMedia, async (event, id: unknown, path: unknown, reference: MediaReference | null): Promise<MediaCheckResult> => {
        checkSender(event);
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
    contents.ipc.on(fileChannels.cancelMediaRead, (event, id: unknown) => {
        if (event.senderFrame !== contents.mainFrame || typeof id !== "string") return;
        checks.get(id)?.abort();
    });
    contents.ipc.handle(fileChannels.getMediaURL, async (event, path: unknown): Promise<MediaURLResult> => {
        checkSender(event);
        const current = generation;
        const result = await getMediaURL(path);
        if (result.status === "ready" && current !== generation) {
            await releaseMediaURL(result.id);
            return { status: "unreadable", error: { kind: "media-source-invalidated" } };
        }
        return result;
    });
    contents.ipc.handle(fileChannels.releaseMediaURL, (event, id: unknown) => {
        checkSender(event);
        return releaseMediaURL(id);
    });
    contents.ipc.handle(fileChannels.selectMediaPath, (event, path: unknown) => {
        checkSender(event);
        return selectMediaPath(window, path);
    });
    contents.ipc.handle(fileChannels.selectMediaPaths, event => {
        checkSender(event);
        return selectMediaPaths(window);
    });
    contents.ipc.handle(fileChannels.selectDirectory, (event, value: unknown) => {
        checkSender(event);
        const kind = directoryKind(value);
        return selectDirectory(window, kind, directoryRoots[kind]);
    });
    contents.ipc.handle(fileChannels.listDirectories, (event, value: unknown) => {
        checkSender(event);
        return listDirectories(directoryRoots[directoryKind(value)]);
    });
    contents.ipc.handle(fileChannels.openFFmpegDirectory, async event => {
        checkSender(event);
        const executable = await findExecutable(runtimeDirectory, "ffmpeg", "ffmpeg");
        const error = await shell.openPath(dirname(executable));
        if (error) throw new Error(error);
    });
}

function directoryKind(value: unknown): DownloadKind {
    if (value !== "model" && value !== "backend") throw new Error("Unknown directory kind.");
    return value;
}