import { FailureError } from "../../shared/failure";
import { type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { configChannels } from "../../shared/ipc";
import { type ConfigStore } from "./store";

export function registerConfigIPCs(window: BrowserWindow, config: ConfigStore): () => void {
    const contents = window.webContents;
    const checkSender = (event: IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new FailureError({ kind: "ipc-not-main-frame" });
    };
    const rememberWindow = (): void => {
        if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
        const { width, height } = window.getNormalBounds();
        config.updateWindow({ width, height, maximized: window.isMaximized() });
    };
    window.on("resize", rememberWindow);
    window.on("maximize", rememberWindow);
    window.on("unmaximize", rememberWindow);
    window.on("restore", rememberWindow);
    window.on("leave-full-screen", rememberWindow);
    contents.ipc.handle(configChannels.get, event => {
        checkSender(event);
        return config.get();
    });
    contents.ipc.handle(configChannels.update, (event, patch: unknown) => {
        checkSender(event);
        return config.update(patch);
    });
    contents.ipc.handle(configChannels.setSidebarWidth, (event, width: unknown) => {
        checkSender(event);
        return config.setSidebarWidth(width);
    });
    contents.ipc.handle(configChannels.updatePlayback, (event, patch: unknown) => {
        checkSender(event);
        return config.updatePlayback(patch);
    });
    contents.ipc.handle(configChannels.save, event => {
        checkSender(event);
        rememberWindow();
        return config.save();
    });
    const unsubscribe = config.subscribe(snapshot => {
        if (!contents.isDestroyed()) contents.send(configChannels.changed, snapshot);
    });
    contents.once("destroyed", unsubscribe);
    return rememberWindow;
}