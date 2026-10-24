import { handle } from "../util/ipc";
import { type BrowserWindow } from "electron";
import { settingsChannels } from "../../shared/ipc";
import * as settings from "./store";

export function registerSettingsIPCs(window: BrowserWindow): () => void {
    const contents = window.webContents;
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
    handle(contents, settingsChannels.get, () => {
        return settings.get();
    });
    handle(contents, settingsChannels.update, (patch: unknown) => {
        return settings.update(patch);
    });
    handle(contents, settingsChannels.flush, (revision: unknown) => {
        rememberWindow();
        return settings.flush(typeof revision === "number" ? revision : NaN);
    });
    const unsubscribe = settings.subscribe(snapshot => {
        if (!contents.isDestroyed()) contents.send(settingsChannels.changed, snapshot);
    });
    contents.once("destroyed", unsubscribe);
    return rememberWindow;
}