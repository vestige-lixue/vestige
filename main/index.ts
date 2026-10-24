import { setLocale } from "./ui/i18n";
import { app, BrowserWindow, nativeTheme, screen } from "electron";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { registerTranscriptionIPCs } from "./transcription/ipc";
import { registerProjectIPCs } from "./project/ipc";
import { registerWindowLifecycle } from "./lifecycle";
import { appChannels } from "../shared/ipc";
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
import { createAppPaths } from "./paths";
import { registerAppIPCs } from "./app";
import { getWindowIcon, registerWindowBehavior } from "./ui/window";

app.setName("Vestige");
registerMediaScheme();

// Set both paths before ready, so development also isolates Chromium state.
const paths = createAppPaths({
    packaged: app.isPackaged,
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath("userData"),
    temporaryPath: app.getPath("temp"),
    profile: process.env["VESTIGE_PROFILE"]
});
mkdirSync(paths.sessionDirectory, { recursive: true });
app.setPath("userData", paths.dataDirectory);
app.setPath("sessionData", paths.sessionDirectory);
const logs = new LogDirectory(paths.logsDirectory);
const applicationLog = logs.create("application");
const restoreConsole = captureConsole(applicationLog);
applicationLog?.record("Environment", { version: app.getVersion(), platform: process.platform, arch: process.arch, versions: process.versions, dataPath: paths.dataDirectory });
process.on("uncaughtExceptionMonitor", error => applicationLog?.record("Uncaught exception", error));
process.once("exit", code => {
    restoreConsole();
    applicationLog?.close(`exit ${code}`);
});
settings.initialize(paths.dataDirectory);
setLocale(settings.get().settings.language);
settings.subscribe(snapshot => setLocale(snapshot.settings.language));

mkdirSync(paths.modelDirectory, { recursive: true });
mkdirSync(paths.backendDirectory, { recursive: true });
// Refresh the bundled documents once per application launch; all windows share this work.
const documentationReady = initializeDocumentation(paths.documentationDirectory, paths.documentationSourceDirectory).catch(console.error);

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

    registerWindowBehavior(mainWindow, app.isPackaged, applicationLog);
    const tasks = registerTaskOutputIPCs(mainWindow.webContents, logs);
    registerDocumentationIPCs(mainWindow.webContents, paths.documentationDirectory, documentationReady);
    const stopDownloads = registerDownloadIPCs(mainWindow.webContents, {
        modelDirectory: paths.modelDirectory,
        backendDirectory: paths.backendDirectory,
        runtimeDirectory: paths.runtimeDirectory,
        runtimeCacheDirectory: paths.runtimeCacheDirectory
    }, tasks);
    registerFileIPCs(mainWindow, {
        runtimeDirectory: paths.runtimeDirectory,
        modelDirectory: paths.modelDirectory,
        backendDirectory: paths.backendDirectory
    });
    registerAppIPCs(mainWindow.webContents, logs);
    registerProjectIPCs(mainWindow);
    const rememberWindow = registerSettingsIPCs(mainWindow);
    registerWindowTheme(mainWindow);
    registerWindowLifecycle(mainWindow, stopDownloads);
    registerTranscriptionIPCs(mainWindow.webContents, {
        runtimeDirectory: paths.runtimeDirectory,
        modelDirectory: paths.modelDirectory,
        backendDirectory: paths.backendDirectory,
        temporaryDirectory: paths.temporaryDirectory,
        vadModelPath: paths.vadModelPath
    }, tasks);

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