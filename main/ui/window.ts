import { shell, nativeTheme, type BrowserWindow } from "electron";
import iconBlack from "../../resources/logos/logo-square-black.png?asset";
import iconWhite from "../../resources/logos/logo-square-white.png?asset";
import windowsIconBlack from "../../resources/logos/logo-square-black.ico?asset";
import windowsIconWhite from "../../resources/logos/logo-square-white.ico?asset";
import { type LogFile } from "../logging";

function openExternal(url: string): void {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(console.error);
}

export function getWindowIcon(): string {
    const dark = process.platform === "linux" ? nativeTheme.shouldUseDarkColors : nativeTheme.shouldUseDarkColorsForSystemIntegratedUI;
    if (process.platform === "win32") return dark ? windowsIconWhite : windowsIconBlack;
    return dark ? iconWhite : iconBlack;
}

export function registerWindowBehavior(window: BrowserWindow, packaged: boolean, log: LogFile | null): void {
    const contents = window.webContents;
    contents.on("console-message", details => {
        log?.record(`renderer ${details.level} ${details.sourceId}:${details.lineNumber}`, details.message);
    });
    contents.on("render-process-gone", (_event, details) => log?.record("Renderer exited", details));
    if (process.platform !== "darwin") {
        window.removeMenu();
        const updateWindowIcon = (): void => window.setIcon(getWindowIcon());
        nativeTheme.on("updated", updateWindowIcon);
        window.once("closed", () => nativeTheme.off("updated", updateWindowIcon));
    }
    contents.setWindowOpenHandler(({ url }) => {
        openExternal(url);
        return { action: "deny" };
    });
    contents.on("will-navigate", (event, url) => {
        if (url !== contents.getURL()) {
            event.preventDefault();
            openExternal(url);
        }
    });
    contents.on("before-input-event", (event, input) => {
        const command = input.control || input.meta;
        // Disable native reload/close/quit shortcuts while keeping page key events.
        contents.setIgnoreMenuShortcuts(
            command && (input.code === "KeyR" || input.code === "KeyW" || input.key.toLowerCase() === "q")
        );
        if (input.type !== "keyDown") return;
        if (input.code === "F12" && !input.control && !input.meta && !input.alt && !input.shift) {
            event.preventDefault();
            if (!input.isAutoRepeat) {
                if (!packaged && !contents.isDevToolsOpened()) contents.openDevTools({ mode: "undocked" });
                else contents.toggleDevTools();
            }
            return;
        }
        const zoomCommand = !input.alt && (process.platform === "darwin" ? input.meta && !input.control : input.control && !input.meta);
        if (
            (zoomCommand && (input.code === "Minus" || (input.code === "Equal" && input.shift)))
         || (packaged && input.code === "KeyI" && ((input.control && input.shift) || (input.meta && input.alt)))
        ) {
            event.preventDefault();
        }
    });
}