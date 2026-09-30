import { app, type BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import { appChannels } from "../shared/ipc";

const checks = new Map<BrowserWindow, () => Promise<boolean>>();
let allowQuit = false;
let pendingQuit: Promise<void> | null = null;

app.on("before-quit", event => {
    if (allowQuit) return;
    event.preventDefault();
    if (pendingQuit) return;
    pendingQuit = Promise.all([...checks.values()].map(check => check())).then(blocked => {
        if (blocked.some(Boolean)) return;
        allowQuit = true;
        app.quit();
    }).catch(console.error).finally(() => {
        pendingQuit = null;
    });
});

export function registerWindowLifecycle(window: BrowserWindow): void {
    const contents = window.webContents;
    let allowClose = false;
    let closing = false;
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
    checks.set(window, beforeQuit);

    contents.ipc.on(appChannels.beforeQuitResult, (event, id: unknown, block: unknown) => {
        if (event.senderFrame !== contents.mainFrame || id !== pending?.id) return;
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
        beforeQuit().then(block => {
            if (block || pendingQuit || window.isDestroyed()) return;
            allowClose = true;
            window.close();
        }).catch(console.error).finally(() => {
            closing = false;
        });
    });
    window.once("closed", () => {
        pending?.finish(true);
        checks.delete(window);
    });
}