import { VestigeErrors } from "../../shared/failure";
import { selectOpenProjectPath, selectSaveProjectPath } from "../ui/fileDialogs";
import { type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { getProject, saveProject, checkProjectFile } from "./file";
import { type Project } from "../../shared/project/Project";
import { projectChannels } from "../../shared/ipc";
import * as settings from "../settings/store";

export function registerProjectIPCs(window: BrowserWindow): void {
    const contents = window.webContents;
    const checkSender = (event: IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new VestigeErrors({ kind: "ipc-not-main-frame" });
    };
    contents.ipc.handle(projectChannels.get, (event, path: unknown) => {
        checkSender(event);
        return getProject(path);
    });
    contents.ipc.handle(projectChannels.checkFile, (event, path: unknown) => {
        checkSender(event);
        return checkProjectFile(path);
    });
    contents.ipc.handle(projectChannels.save, (event, path: unknown, project: Project) => {
        checkSender(event);
        const { compressProjectFiles, mediaPathMode, playback } = settings.get().settings;
        return saveProject(path, project, compressProjectFiles, playback.rememberPlaybackPosition, mediaPathMode);
    });
    contents.ipc.handle(projectChannels.openDialog, event => {
        checkSender(event);
        return selectOpenProjectPath(window);
    });
    contents.ipc.handle(projectChannels.saveDialog, (event, path: unknown, saveAs: unknown) => {
        checkSender(event);
        return selectSaveProjectPath(window, path, saveAs === true);
    });
}