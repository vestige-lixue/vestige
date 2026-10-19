import { VestigeErrors } from "../../shared/failure";
import { type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { settingsChannels } from "../../shared/ipc";
import * as settings from "./store";

export function registerSettingsIPCs(window: BrowserWindow): () => void {
    const contents = window.webContents;
    const checkSender = (event: IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new VestigeErrors({ kind: "ipc-not-main-frame" });
    };
    const rememberWindow = (): void => {
        if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
        const { width, height } = window.getNormalBounds();
        settings.updateWindow({ width, height, maximized: window.isMaximized() });
    };
    window.on("resize", rememberWindow);
    window.on("maximize", rememberWindow);
    window.on("unmaximize", rememberWindow);
    window.on("restore", rememberWindow);
    window.on("leave-full-screen", rememberWindow);
    contents.ipc.handle(settingsChannels.get, event => {
        checkSender(event);
        return settings.get();
    });
    contents.ipc.handle(settingsChannels.update, (event, patch: unknown) => {
        checkSender(event);
        return settings.update(patch);
    });
    contents.ipc.handle(settingsChannels.save, event => {
        checkSender(event);
        rememberWindow();
        return settings.save();
    });
    const unsubscribe = settings.subscribe(snapshot => {
        if (!contents.isDestroyed()) contents.send(settingsChannels.changed, snapshot);
    });
    contents.once("destroyed", unsubscribe);
    return rememberWindow;
}