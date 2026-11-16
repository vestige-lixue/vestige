import { handle } from "../util/ipc";
import { type BrowserWindow } from "electron";
import { settingsChannels } from "../../shared/ipc";
import * as settings from "./store";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { type SettingsFileResult, type SettingsImportResult } from "../../shared/settings/Settings";
import { normalizeSettings } from "./file";
import { parseSettings } from "./validate";
import { isExpectedFailure } from "../../shared/failure";
import { decodeUTF8, parseJSON } from "../util/data";
import { isSystemError } from "../util/file";
import { fileOperationFailure, writeFileAtomic } from "../util/fs";
import { selectSettingsImportPath, selectSettingsExportPath, selectSettingsBackupPath } from "../ui/fileDialogs";

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
    handle(contents, settingsChannels.retryLoad, () => settings.retryLoad());
    handle(contents, settingsChannels.backupAndReset, () => settings.backupAndReset(() => selectSettingsBackupPath(window)));
    handle(contents, settingsChannels.update, (patch: unknown) => {
        return settings.update(patch);
    });
    handle(contents, settingsChannels.replace, (value: unknown) => settings.replace(value));
    handle(contents, settingsChannels.importFile, async (): Promise<SettingsImportResult> => {
        const path = await selectSettingsImportPath(window);
        if (path === null) return { success: true, canceled: true };
        let bytes: Buffer;
        try {
            bytes = await readFile(path);
        }
        catch (error) {
            if (isSystemError(error)) return { success: false, error: fileOperationFailure(error, "read", path) };
            throw error;
        }
        try {
            const value = parseSettings(normalizeSettings(parseJSON(decodeUTF8(bytes))));
            return { success: true, canceled: false, name: basename(path), settings: value };
        }
        catch (error) {
            if (isExpectedFailure(error)) return { success: false, error: error.failure };
            throw error;
        }
    });
    handle(contents, settingsChannels.exportFile, async (): Promise<SettingsFileResult> => {
        const path = await selectSettingsExportPath(window);
        if (path === null) return { success: true, canceled: true };
        try {
            await writeFileAtomic(path, JSON.stringify(settings.get().settings, null, 4), { sync: true, mode: undefined });
            return { success: true, canceled: false };
        }
        catch (error) {
            if (isSystemError(error)) return { success: false, error: fileOperationFailure(error, "write", path) };
            throw error;
        }
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