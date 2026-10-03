import { BrowserWindow, dialog, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from "electron";
import { fileChannels } from "../../shared/ipc";
import { type MediaReference } from "../../shared/media/check";
import { filePath } from "../util/file";
import { readMedia } from "./media";
import { mediaFilters } from "../../shared/media/formats";
import { registerMediaProtocol, openMediaSource, closeMediaSource, closeMediaSources } from "./source";

export function registerFileIPCs(contents: WebContents): void {
    registerMediaProtocol(contents.session);
    const checks = new Map<string, AbortController>();
    const checkSender = (event: IpcMainEvent | IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new Error("File access is only available to the main frame.");
    };
    const cancelAll = (): void => {
        for (const controller of checks.values()) controller.abort();
        closeMediaSources(contents);
    };
    contents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) cancelAll();
    });
    contents.on("render-process-gone", cancelAll);
    contents.once("destroyed", cancelAll);
    contents.ipc.handle(fileChannels.normalize, (event, path: unknown) => {
        checkSender(event);
        return filePath(path);
    });
    contents.ipc.handle(fileChannels.readMedia, async (event, id: unknown, path: unknown, reference: MediaReference | null) => {
        checkSender(event);
        if (typeof id !== "string" || !id || id.length > 128 || checks.has(id)) throw new Error("A unique media check ID is required.");
        const controller = new AbortController();
        checks.set(id, controller);
        try {
            return await readMedia(path, reference, controller.signal);
        }
        finally {
            checks.delete(id);
        }
    });
    contents.ipc.on(fileChannels.cancelMediaRead, (event, id: unknown) => {
        if (event.senderFrame !== contents.mainFrame || typeof id !== "string") return;
        checks.get(id)?.abort();
    });
    contents.ipc.handle(fileChannels.openMediaSource, (event, path: unknown) => {
        checkSender(event);
        return openMediaSource(contents, path);
    });
    contents.ipc.on(fileChannels.closeMediaSource, (event, id: unknown) => {
        if (event.senderFrame === contents.mainFrame) closeMediaSource(contents, id);
    });
    contents.ipc.handle(fileChannels.selectMediaPath, async (event, path: unknown) => {
        checkSender(event);
        const window = BrowserWindow.fromWebContents(contents);
        if (!window) throw new Error("The project window is no longer available.");
        const result = await dialog.showOpenDialog(window, {
            title: "重新定位媒体文件",
            filters: mediaFilters,
            defaultPath: typeof path === "string" ? path : undefined,
            properties: ["openFile"]
        });
        return result.canceled || !result.filePaths[0] ? null : filePath(result.filePaths[0]);
    });
    contents.ipc.handle(fileChannels.selectMediaPaths, async event => {
        checkSender(event);
        const window = BrowserWindow.fromWebContents(contents);
        if (!window) throw new Error("The project window is no longer available.");
        const result = await dialog.showOpenDialog(window, {
            title: "导入媒体", filters: mediaFilters, properties: ["openFile", "multiSelections"]
        });
        return result.canceled ? [] : result.filePaths.map(path => filePath(path));
    });
}