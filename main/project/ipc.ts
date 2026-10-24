import { selectOpenProjectPath, selectSaveProjectPath } from "../ui/fileDialogs";
import { type BrowserWindow } from "electron";
import { getProject, saveProject, checkProjectFile } from "./file";
import { projectChannels } from "../../shared/ipc";
import * as settings from "../settings/store";
import { handle } from "../util/ipc";

export function registerProjectIPCs(window: BrowserWindow): void {
    const contents = window.webContents;
    handle(contents, projectChannels.get, (path: unknown) => getProject(path));
    handle(contents, projectChannels.checkFile, (path: unknown) => checkProjectFile(path));
    handle(contents, projectChannels.save, (path: unknown, project: unknown) => {
        const { compressProjectFiles, mediaPathMode, playback } = settings.get().settings;
        return saveProject(path, project, compressProjectFiles, playback.rememberPlaybackPosition, mediaPathMode);
    });
    handle(contents, projectChannels.openDialog, () => selectOpenProjectPath(window));
    handle(contents, projectChannels.saveDialog, (path: unknown, saveAs: unknown) => selectSaveProjectPath(window, path, saveAs === true));
}