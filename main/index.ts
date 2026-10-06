import { setLocale } from "./ui/i18n";
import { app, shell, BrowserWindow, nativeTheme, screen } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import iconBlack from "../resources/logos/logo-square-black.png?asset";
import iconWhite from "../resources/logos/logo-square-white.png?asset";
import windowsIconBlack from "../resources/logos/logo-square-black.ico?asset";
import windowsIconWhite from "../resources/logos/logo-square-white.ico?asset";
import { registerTranscriptionIPCs } from "./transcription/ipc";
import { registerProjectIPCs } from "./project/ipc";
import { registerWindowLifecycle } from "./lifecycle";
import { appChannels } from "../shared/ipc";
import { type EditAction } from "../shared/app";
import { filePath } from "./util/file";
import { registerFileIPCs } from "./file/ipc";
import { registerMediaScheme, registerMediaProtocol } from "./file/source";
import { ConfigStore } from "./config/store";
import { registerConfigIPCs } from "./config/ipc";
import { minWindowHeight, minWindowWidth } from "../shared/config/defaults";

app.setName("Vestige");
registerMediaScheme();

function developmentDataPath(projectPath: string, profile = "default"): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(profile)) {
        throw new Error("VESTIGE_PROFILE must contain 1-64 letters, digits, underscores, or hyphens, and start with a letter or digit.");
    }
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(profile)) {
        throw new Error("VESTIGE_PROFILE must not be a Windows reserved device name.");
    }
    return join(projectPath, ".local", "profiles", profile);
}

// Set both paths before ready, so development also isolates Chromium state.
const dataPath = app.isPackaged ? app.getPath("userData") : developmentDataPath(app.getAppPath(), process.env["VESTIGE_PROFILE"]);
const sessionPath = join(dataPath, "chromium");
mkdirSync(sessionPath, { recursive: true });
app.setPath("userData", dataPath);
app.setPath("sessionData", sessionPath);
const config = new ConfigStore(dataPath);
setLocale(config.get().config.language);
config.subscribe(snapshot => setLocale(snapshot.config.language));

function openExternal(url: string): void {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(console.error);
}

function getWindowIcon(): string {
    const dark = process.platform === "linux" ? nativeTheme.shouldUseDarkColors : nativeTheme.shouldUseDarkColorsForSystemIntegratedUI;
    if (process.platform === "win32") return dark ? windowsIconWhite : windowsIconBlack;
    return dark ? iconWhite : iconBlack;
}

function createWindow(): void {
    const windowState = config.get().config.window;
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    const mainWindow = new BrowserWindow({
        title: "Vestige",
        width: Math.max(minWindowWidth, Math.min(windowState.width, workArea.width)),
        height: Math.max(minWindowHeight, Math.min(windowState.height, workArea.height)),
        minWidth: minWindowWidth,
        minHeight: minWindowHeight,
        show: false,
        backgroundColor: "#ffffff",
        titleBarStyle: "hidden",
        ...(process.platform === "darwin"
            ? { titleBarOverlay: true, trafficLightPosition: { x: 16, y: 20 } }
            : { titleBarOverlay: {
                color: "#ffffff",
                symbolColor: "#252a30",
                height: 48
            } }),
        icon: getWindowIcon(),
        webPreferences: {
            preload: fileURLToPath(new URL("../preload/index.cjs", import.meta.url)),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    const runtimeDirectory = filePath(join(app.isPackaged ? process.resourcesPath : join(app.getAppPath(), "resources"), "bin"));
    registerFileIPCs(mainWindow, runtimeDirectory);
    mainWindow.webContents.ipc.on(appChannels.edit, (event, action: unknown) => {
        if (event.senderFrame !== mainWindow.webContents.mainFrame || typeof action !== "string"
            || !["undo", "redo", "cut", "copy", "paste"].includes(action)) return;
        mainWindow.webContents[action as EditAction]();
    });
    registerProjectIPCs(mainWindow);
    const rememberWindow = registerConfigIPCs(mainWindow, config);
    registerWindowLifecycle(mainWindow);
    registerTranscriptionIPCs(mainWindow.webContents, {
        runtimeDirectory,
        modelDirectory: filePath(join(app.getPath("userData"), "models")),
        temporaryDirectory: filePath(join(app.getPath("temp"), "vestige-transcription"))
    });

    if (process.platform !== "darwin") {
        mainWindow.removeMenu();
        const updateWindowIcon = (): void => mainWindow.setIcon(getWindowIcon());
        nativeTheme.on("updated", updateWindowIcon);
        mainWindow.once("closed", () => nativeTheme.off("updated", updateWindowIcon));
    }

    mainWindow.once("ready-to-show", () => {
        if (windowState.maximized) mainWindow.maximize();
        rememberWindow();
        mainWindow.show();
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        openExternal(url);
        return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
        if (url !== mainWindow.webContents.getURL()) {
            event.preventDefault();
            openExternal(url);
        }
    });

    mainWindow.webContents.ipc.on(appChannels.openDevTools, event => {
        if (event.senderFrame !== mainWindow.webContents.mainFrame) return;
        mainWindow.webContents.openDevTools({ mode: "detach" });
    });

    mainWindow.webContents.ipc.on(appChannels.quit, event => {
        if (event.senderFrame !== mainWindow.webContents.mainFrame) return;
        app.quit();
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
        const command = input.control || input.meta;
        // Disable native reload/close/quit shortcuts while keeping page key events.
        mainWindow.webContents.setIgnoreMenuShortcuts(
            command && (input.code === "KeyR" || input.code === "KeyW" || input.key.toLowerCase() === "q")
        );

        if (input.code === "F11") {
            event.preventDefault();
            return;
        }
        if (input.type !== "keyDown") return;

        if (input.code === "F12") {
            event.preventDefault();
            if (!input.isAutoRepeat) {
                if (!app.isPackaged && !mainWindow.webContents.isDevToolsOpened()) {
                    mainWindow.webContents.openDevTools({ mode: "undocked" });
                }
                else mainWindow.webContents.toggleDevTools();
            }
            return;
        }

        if (
            (command && (input.code === "Minus" || (input.code === "Equal" && input.shift)))
         || (app.isPackaged && input.code === "KeyI" && ((input.control && input.shift) || (input.meta && input.alt)))
        ) {
            event.preventDefault();
        }
    });

    // HMR support, do not remove
    if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
        mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    }
    else {
        mainWindow.loadFile(fileURLToPath(new URL("../renderer/index.html", import.meta.url)));
    }
}

app.whenReady().then(() => {
    registerMediaProtocol();
    app.setAppUserModelId("vestige.lixue");
    if (process.platform === "darwin") {
        const updateDockIcon = (): void => app.dock?.setIcon(getWindowIcon());
        updateDockIcon();
        nativeTheme.on("updated", updateDockIcon);
    }
    createWindow();
});

// If there are no open windows, create a new one on activation.
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});