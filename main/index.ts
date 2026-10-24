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
import * as settings from "./settings/store";
import { registerSettingsIPCs } from "./settings/ipc";
import { minWindowHeight, minWindowWidth } from "../shared/constants";
import { getWindowColors, registerWindowTheme } from "./theme";
import { registerTaskOutputIPCs } from "./task/ipc";
import { registerDocumentationIPCs } from "./documentation/ipc";
import { registerDownloadIPCs } from "./downloads/ipc";
import { initializeDocumentation } from "./documentation/file";
import { captureConsole, LogDirectory } from "./logging";
import { VestigeErrors } from "../shared/failure";

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
const logs = new LogDirectory(join(dataPath, "logs"));
const applicationLog = logs.create("application");
const restoreConsole = captureConsole(applicationLog);
applicationLog?.record("Environment", { version: app.getVersion(), platform: process.platform, arch: process.arch, versions: process.versions, dataPath });
process.on("uncaughtExceptionMonitor", error => applicationLog?.record("Uncaught exception", error));
process.once("exit", code => {
    restoreConsole();
    applicationLog?.close(`exit ${code}`);
});
settings.initialize(dataPath);
setLocale(settings.get().settings.language);
settings.subscribe(snapshot => setLocale(snapshot.settings.language));

function openExternal(url: string): void {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(console.error);
}

function getWindowIcon(): string {
    const dark = process.platform === "linux" ? nativeTheme.shouldUseDarkColors : nativeTheme.shouldUseDarkColorsForSystemIntegratedUI;
    if (process.platform === "win32") return dark ? windowsIconWhite : windowsIconBlack;
    return dark ? iconWhite : iconBlack;
}

function createWindow(): void {
    const windowState = settings.get().settings.window;
    const colors = getWindowColors();
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    const mainWindow = new BrowserWindow({
        title: "Vestige",
        width: Math.max(minWindowWidth, Math.min(windowState.width, workArea.width)),
        height: Math.max(minWindowHeight, Math.min(windowState.height, workArea.height)),
        minWidth: minWindowWidth,
        minHeight: minWindowHeight,
        show: false,
        fullscreenable: false,
        backgroundColor: colors["--c-background"],
        titleBarStyle: "hidden",
        ...(process.platform === "darwin"
            ? { titleBarOverlay: true, trafficLightPosition: { x: 16, y: 20 } }
            : { titleBarOverlay: {
                color: colors["--c-background"],
                symbolColor: colors["--c-text"],
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

    const resourcesDirectory = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), "resources");
    const runtimeDirectory = filePath(join(resourcesDirectory, "bin"));
    const modelDirectory = filePath(join(dataPath, "models"));
    const backendDirectory = filePath(join(dataPath, "backends"));
    mkdirSync(modelDirectory, { recursive: true });
    mkdirSync(backendDirectory, { recursive: true });
    const documentationReady = initializeDocumentation(filePath(dataPath), filePath(join(resourcesDirectory, "docs"))).catch(console.error);
    mainWindow.webContents.on("console-message", details => {
        applicationLog?.record(`renderer ${details.level} ${details.sourceId}:${details.lineNumber}`, details.message);
    });
    mainWindow.webContents.on("render-process-gone", (_event, details) => applicationLog?.record("Renderer exited", details));
    const tasks = registerTaskOutputIPCs(mainWindow.webContents, logs);
    registerDocumentationIPCs(mainWindow.webContents, filePath(dataPath), documentationReady);
    const stopDownloads = registerDownloadIPCs(mainWindow.webContents, { model: modelDirectory, backend: backendDirectory }, runtimeDirectory, tasks);
    registerFileIPCs(mainWindow, runtimeDirectory, modelDirectory, backendDirectory);
    mainWindow.webContents.ipc.on(appChannels.edit, (event, action: unknown) => {
        if (event.senderFrame !== mainWindow.webContents.mainFrame || typeof action !== "string"
            || !["selectAll", "undo", "redo", "cut", "copy", "paste"].includes(action)) return;
        mainWindow.webContents[action as EditAction]();
    });
    mainWindow.webContents.ipc.handle(appChannels.clearLogs, event => {
        if (event.senderFrame !== mainWindow.webContents.mainFrame) throw new VestigeErrors({ kind: "ipc-not-main-frame" });
        logs.clear();
    });
    registerProjectIPCs(mainWindow);
    const rememberWindow = registerSettingsIPCs(mainWindow);
    registerWindowTheme(mainWindow);
    registerWindowLifecycle(mainWindow, stopDownloads);
    registerTranscriptionIPCs(mainWindow.webContents, {
        runtimeDirectory,
        modelDirectory,
        backendDirectory,
        temporaryDirectory: filePath(join(app.getPath("temp"), "vestige-transcription"))
    }, tasks);

    if (process.platform !== "darwin") {
        mainWindow.removeMenu();
        const updateWindowIcon = (): void => mainWindow.setIcon(getWindowIcon());
        nativeTheme.on("updated", updateWindowIcon);
        mainWindow.once("closed", () => nativeTheme.off("updated", updateWindowIcon));
    }

    let rendererReady = false, windowReady = false;
    const showWindow = (): void => {
        if (!rendererReady || !windowReady || mainWindow.isDestroyed()) return;
        rendererReady = false;
        if (windowState.maximized) mainWindow.maximize();
        rememberWindow();
        mainWindow.show();
    };
    mainWindow.webContents.ipc.on(appChannels.ready, event => {
        if (event.senderFrame !== mainWindow.webContents.mainFrame || mainWindow.isVisible()) return;
        rendererReady = true;
        showWindow();
    });
    mainWindow.once("ready-to-show", () => {
        windowReady = true;
        showWindow();
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

        if (input.type !== "keyDown") return;

        if (input.code === "F12" && !input.control && !input.meta && !input.alt && !input.shift) {
            event.preventDefault();
            if (!input.isAutoRepeat) {
                if (!app.isPackaged && !mainWindow.webContents.isDevToolsOpened()) {
                    mainWindow.webContents.openDevTools({ mode: "undocked" });
                }
                else mainWindow.webContents.toggleDevTools();
            }
            return;
        }

        const zoomCommand = !input.alt && (process.platform === "darwin" ? input.meta && !input.control : input.control && !input.meta);
        if (
            (zoomCommand && (input.code === "Minus" || (input.code === "Equal" && input.shift)))
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