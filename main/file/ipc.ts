import { dialog, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { fileChannels } from "../../shared/ipc";
import { type MediaReference } from "../../shared/media/check";
import { type AbsolutePath } from "../../shared/util/path";
import { filePath } from "../util/file";
import { readMedia } from "./media";
import { getMediaURL, releaseMediaURL, releaseMediaURLs } from "./source";

const mediaFilters = [
    { name: "音视频文件", extensions: [
        "wav", "mp3", "m4a", "aac", "flac", "ogg", "opus", "aiff", "aif",
        "mp4", "m4v", "webm", "mov", "mkv", "avi"
    ] },
    { name: "所有文件", extensions: ["*"] }
];

export function registerFileIPCs(window: BrowserWindow, runtimeDirectory: AbsolutePath): void {
    const contents = window.webContents;
    const checks = new Map<string, AbortController>();
    let generation = 0;
    const checkSender = (event: IpcMainEvent | IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new Error("File access is only available to the main frame.");
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
    contents.ipc.handle(fileChannels.getMediaURL, async (event, path: unknown) => {
        checkSender(event);
        const current = generation;
        const result = await getMediaURL(path);
        if (result.status === "ready" && current !== generation) {
            await releaseMediaURL(result.id);
            return { status: "unreadable", error: "前端已重新加载或退出，媒体源请求已取消。" };
        }
        return result;
    });
    contents.ipc.handle(fileChannels.releaseMediaURL, (event, id: unknown) => {
        checkSender(event);
        return releaseMediaURL(id);
    });
    contents.ipc.handle(fileChannels.selectMediaPath, async (event, path: unknown) => {
        checkSender(event);
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
        const result = await dialog.showOpenDialog(window, {
            title: "导入媒体", filters: mediaFilters, properties: ["openFile", "multiSelections"]
        });
        return result.canceled ? [] : result.filePaths.map(path => filePath(path));
    });
}