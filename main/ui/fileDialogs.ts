import { t } from "./i18n";
import { dialog, type BrowserWindow } from "electron";
import { type AbsolutePath } from "../../shared/util/path";
import { type DownloadKind } from "../../shared/downloads";
import { filePath } from "../util/file";

export async function selectDirectory(window: BrowserWindow, kind: DownloadKind, root: AbsolutePath): Promise<AbsolutePath | null> {
    const result = await dialog.showOpenDialog(window, {
        buttonLabel: t(`native.directories.${kind}.confirm`),
        title: t(`native.directories.${kind}.title`), defaultPath: root, properties: ["openDirectory"]
    });
    return result.canceled || !result.filePaths[0] ? null : filePath(result.filePaths[0]);
}

// Native dialogs are a presentation boundary too. Derive their options when opening.
function mediaFilters(): Electron.FileFilter[] {
    return [
        { name: t("native.filters.media"), extensions: [
            "wav", "mp3", "m4a", "aac", "flac", "ogg", "opus", "aiff", "aif",
            "mp4", "m4v", "webm", "mov", "mkv", "avi"
        ] },
        { name: t("native.filters.all"), extensions: ["*"] }
    ];
}

export async function selectMediaPath(window: BrowserWindow, path: unknown): Promise<AbsolutePath | null> {
    const result = await dialog.showOpenDialog(window, {
        title: t("native.media.locate.title"), filters: mediaFilters(),
        buttonLabel: t("native.media.locate.confirm"),
        defaultPath: typeof path === "string" ? path : undefined,
        properties: ["openFile"]
    });
    return result.canceled || !result.filePaths[0] ? null : filePath(result.filePaths[0]);
}

export async function selectMediaPaths(window: BrowserWindow): Promise<AbsolutePath[]> {
    const result = await dialog.showOpenDialog(window, {
        buttonLabel: t("native.media.import.confirm"),
        title: t("native.media.import.title"), filters: mediaFilters(), properties: ["openFile", "multiSelections"]
    });
    return result.canceled ? [] : result.filePaths.map(path => filePath(path));
}

export async function selectOpenProjectPath(window: BrowserWindow): Promise<AbsolutePath | null> {
    const result = await dialog.showOpenDialog(window, {
        title: t("native.project.open.title"),
        buttonLabel: t("native.project.open.confirm"),
        filters: [{ name: t("native.filters.project"), extensions: ["vestige"] }], properties: ["openFile"]
    });
    return result.canceled || !result.filePaths[0] ? null : filePath(result.filePaths[0]);
}

export async function selectSaveProjectPath(window: BrowserWindow, path: unknown, saveAs: boolean): Promise<AbsolutePath | null> {
    const result = await dialog.showSaveDialog(window, {
        title: t(saveAs ? "native.project.saveAs.title" : "native.project.save.title"),
        buttonLabel: t(saveAs ? "native.project.saveAs.confirm" : "native.project.save.confirm"),
        filters: [{ name: t("native.filters.project"), extensions: ["vestige"] }],
        defaultPath: path == null ? t("native.project.defaultFileName") : filePath(path),
        properties: ["showOverwriteConfirmation"]
    });
    // Keep the exact confirmed path; appending an extension could overwrite another file.
    return result.canceled || !result.filePath ? null : filePath(result.filePath);
}