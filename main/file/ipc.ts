import { type FilePathResult } from "../../shared/util/file";
import { FailureError, toFailure } from "../../shared/failure";
import { selectMediaPath, selectMediaPaths } from "../ui/fileDialogs";
import { type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { fileChannels } from "../../shared/ipc";
import { type MediaReference, type MediaCheckResult, type MediaURLResult } from "../../shared/media/check";
import { type AbsolutePath } from "../../shared/util/path";
import { filePath } from "../util/file";
import { readMedia } from "./media";
import { getMediaURL, releaseMediaURL, releaseMediaURLs } from "./source";

export function registerFileIPCs(window: BrowserWindow, runtimeDirectory: AbsolutePath): void {
    const contents = window.webContents;
    const checks = new Map<string, AbortController>();
    let generation = 0;
    const checkSender = (event: IpcMainEvent | IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new FailureError({ kind: "ipc-not-main-frame" });
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
            return { success: false, error: toFailure(error) };
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
}