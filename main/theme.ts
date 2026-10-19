import { nativeTheme, type BrowserWindow } from "electron";
import { release } from "node:os";
import * as settings from "./settings/store";
import { appChannels } from "../shared/ipc";
import { VestigeErrors } from "../shared/failure";
import { resolveTheme, resolveThemeScheme, type ThemeColors } from "../shared/theme";

function supportsMica(): boolean {
    // Electron's system backdrop API requires Windows 11 22H2 (build 22621).
    return process.platform === "win32" && Number(release().split(".")[2]) >= 22621;
}

export function getWindowColors(): ThemeColors {
    const theme = settings.get().settings.theme;
    const scheme = resolveThemeScheme(theme.mode, nativeTheme.shouldUseDarkColors);
    return resolveTheme(scheme, theme[scheme]);
}

export function registerWindowTheme(window: BrowserWindow): void {
    const micaSupported = supportsMica();
    const contents = window.webContents;
    contents.ipc.handle(appChannels.supportsMica, event => {
        if (event.senderFrame !== contents.mainFrame) throw new VestigeErrors({ kind: "ipc-not-main-frame" });
        return micaSupported;
    });
    let previous = "";
    let previousMica = false;
    const update = (): void => {
        if (window.isDestroyed()) return;
        const theme = settings.get().settings.theme;
        const mica = micaSupported && theme.translucentSidebar;
        if (micaSupported) {
            const source = mica ? theme.mode : "system";
            if (nativeTheme.themeSource !== source) nativeTheme.themeSource = source;
        }
        const colors = getWindowColors();
        const background = colors["--c-background"], text = colors["--c-text"];
        const next = `${background}:${text}:${mica}`;
        if (next === previous) return;
        previous = next;
        if (micaSupported && mica !== previousMica) {
            window.setBackgroundMaterial(mica ? "mica" : "none");
            previousMica = mica;
        }
        window.setBackgroundColor(mica ? "#00000000" : background);
        if (process.platform !== "darwin") window.setTitleBarOverlay({ color: background, symbolColor: text });
    };
    const unsubscribe = settings.subscribe(update);
    nativeTheme.on("updated", update);
    window.once("closed", () => {
        unsubscribe();
        nativeTheme.off("updated", update);
    });
    update();
}