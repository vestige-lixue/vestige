import { app, shell, BrowserWindow, nativeTheme } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import icon from "../resources/icons/icon.png?asset";
import windowsIconBlack from "../resources/icons/icon-black.ico?asset";
import windowsIconWhite from "../resources/icons/icon-white.ico?asset";

app.setName("Vestige");

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

function openExternal(url: string): void {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(console.error);
}

function getWindowIcon(): string {
    if (process.platform !== "win32") return icon;
    // The Windows taskbar follows the system theme, independently of the app theme.
    return nativeTheme.shouldUseDarkColorsForSystemIntegratedUI ? windowsIconWhite : windowsIconBlack;
}

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        title: "Vestige",
        width: 800,
        height: 600,
        minWidth: 640,
        minHeight: 480,
        show: false,
        backgroundColor: "#ffffff",
        autoHideMenuBar: true,
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

    if (process.platform === "win32") {
        const updateWindowIcon = (): void => mainWindow.setIcon(getWindowIcon());
        nativeTheme.on("updated", updateWindowIcon);
        mainWindow.once("closed", () => nativeTheme.off("updated", updateWindowIcon));
    }

    mainWindow.once("ready-to-show", () => mainWindow.show());
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

    mainWindow.webContents.ipc.on("window:open-devtools", event => {
        if (event.senderFrame !== mainWindow.webContents.mainFrame) return;
        mainWindow.webContents.openDevTools({ mode: "detach" });
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
        const command = input.control || input.meta;
        // Disable native reload/close shortcuts while keeping page key events.
        mainWindow.webContents.setIgnoreMenuShortcuts(
            command && (input.code === "KeyR" || input.code === "KeyW")
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
        void mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    }
    else {
        void mainWindow.loadFile(fileURLToPath(new URL("../renderer/index.html", import.meta.url)));
    }
}

app.whenReady().then(() => {
    app.setAppUserModelId("vestige.lixue");
    createWindow();
});

// If there are no open windows, create a new one on activation.
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});