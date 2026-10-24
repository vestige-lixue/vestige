import { app, type BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import { appChannels } from "../shared/ipc";
import { listen } from "./util/ipc";

let checkBeforeQuit: (() => Promise<boolean>) | null = null;
let allowQuit = false;
let pendingQuit: Promise<void> | null = null;

app.on("before-quit", event => {
    if (allowQuit) return;
    event.preventDefault();
    if (pendingQuit) return;
    pendingQuit = (checkBeforeQuit?.() ?? Promise.resolve(false)).then(blocked => {
        if (blocked) return;
        allowQuit = true;
        app.quit();
    }).catch(console.error).finally(() => {
        pendingQuit = null;
    });
});

export function registerWindowLifecycle(window: BrowserWindow, prepareClose: () => Promise<void> = async () => {}): void {
    const contents = window.webContents;
    let allowClose = false;
    let closing = false;
    let closeCheck: Promise<boolean> | null = null;
    let pending: { id: string; result: Promise<boolean>; finish: (block: boolean) => void } | null = null;

    const beforeQuit = (): Promise<boolean> => {
        if (pending) return pending.result;
        if (contents.isDestroyed() || contents.isLoadingMainFrame()) return Promise.resolve(true);
        const id = randomUUID();
        let finish!: (block: boolean) => void;
        const result = new Promise<boolean>(resolve => {
            finish = block => {
                pending = null;
                resolve(block);
            };
        });
        pending = { id, result, finish };
        try {
            contents.send(appChannels.beforeQuit, id);
        }
        catch (error) {
            finish(true);
            console.error(error);
        }
        return result;
    };
    const checkClose = (): Promise<boolean> => {
        if (closeCheck) return closeCheck;
        closeCheck = beforeQuit().then(async blocked => {
            if (blocked && !window.isDestroyed()) {
                // Native close controls can leave the renderer without window focus.
                if (window.isMinimized()) window.restore();
                window.show();
                if (!contents.isDestroyed()) contents.focus();
            }
            if (!blocked && !window.isDestroyed()) {
                // Closing has been accepted. Prevent new interaction while streams
                // close and temporary files are removed, before destroying the app.
                window.hide();
                try {
                    await prepareClose();
                }
                catch (error) {
                    if (!window.isDestroyed()) window.show();
                    throw error;
                }
            }
            return blocked;
        }).finally(() => {
            closeCheck = null;
        });
        return closeCheck;
    };
    checkBeforeQuit = checkClose;

    listen(contents, appChannels.beforeQuitResult, (id: unknown, block: unknown) => {
        if (id !== pending?.id) return;
        // Missing or malformed answers keep the window open.
        pending?.finish(block !== false);
    });
    contents.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => {
        if (mainFrame && !inPlace) pending?.finish(true);
    });
    contents.on("render-process-gone", () => pending?.finish(true));
    contents.once("destroyed", () => pending?.finish(true));
    contents.on("will-prevent-unload", event => {
        // Only a confirmed native close/quit can bypass the renderer's reload guard.
        if (allowClose || allowQuit) event.preventDefault();
    });
    window.on("close", event => {
        if (allowClose || allowQuit) return;
        event.preventDefault();
        if (closing) return;
        closing = true;
        checkClose().then(block => {
            if (block || pendingQuit || window.isDestroyed()) return;
            allowClose = true;
            window.close();
        }).catch(console.error).finally(() => {
            closing = false;
        });
    });
    window.once("closed", () => {
        pending?.finish(true);
        checkBeforeQuit = null;
    });
}