import { t } from "./i18n";
import { dialog, type BrowserWindow } from "electron";
import { type AbsolutePath } from "../../shared/util/path";
import { filePath } from "../util/file";

// Native dialogs are a presentation boundary too. Derive their options when opening.
function mediaFilters(): Electron.FileFilter[] {
    return [
        { name: t("native.mediaFiles"), extensions: [
            "wav", "mp3", "m4a", "aac", "flac", "ogg", "opus", "aiff", "aif",
            "mp4", "m4v", "webm", "mov", "mkv", "avi"
        ] },
        { name: t("native.allFiles"), extensions: ["*"] }
    ];
}

export async function selectMediaPath(window: BrowserWindow, path: unknown): Promise<AbsolutePath | null> {
    const result = await dialog.showOpenDialog(window, {
        title: t("native.locateMedia"), filters: mediaFilters(),
        defaultPath: typeof path === "string" ? path : undefined,
        properties: ["openFile"]
    });
    return result.canceled || !result.filePaths[0] ? null : filePath(result.filePaths[0]);
}

export async function selectMediaPaths(window: BrowserWindow): Promise<AbsolutePath[]> {
    const result = await dialog.showOpenDialog(window, {
        title: t("native.importMedia"), filters: mediaFilters(), properties: ["openFile", "multiSelections"]
    });
    return result.canceled ? [] : result.filePaths.map(path => filePath(path));
}

export async function selectOpenProjectPath(window: BrowserWindow): Promise<AbsolutePath | null> {
    const result = await dialog.showOpenDialog(window, {
        filters: [{ name: t("native.projectFiles"), extensions: ["vestige"] }], properties: ["openFile"]
    });
    return result.canceled || !result.filePaths[0] ? null : filePath(result.filePaths[0]);
}

export async function selectSaveProjectPath(window: BrowserWindow, path: unknown, saveAs: boolean): Promise<AbsolutePath | null> {
    const result = await dialog.showSaveDialog(window, {
        title: t(saveAs ? "native.saveProjectAs" : "native.saveProject"),
        buttonLabel: t("common.save"),
        filters: [{ name: t("native.projectFiles"), extensions: ["vestige"] }],
        defaultPath: path == null ? t("native.untitled") : filePath(path),
        properties: ["showOverwriteConfirmation"]
    });
    // Keep the exact confirmed path; appending an extension could overwrite another file.
    return result.canceled || !result.filePath ? null : filePath(result.filePath);
}