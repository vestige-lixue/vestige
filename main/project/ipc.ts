import { FailureError } from "../../shared/failure";
import { selectOpenProjectPath, selectSaveProjectPath } from "../ui/fileDialogs";
import { type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { getProject, saveProject } from "./file";
import { type Project } from "../../shared/project/Project";
import { projectChannels } from "../../shared/ipc";

export function registerProjectIPCs(window: BrowserWindow): void {
    const contents = window.webContents;
    const checkSender = (event: IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new FailureError({ kind: "ipc-not-main-frame" });
    };
    contents.ipc.handle(projectChannels.get, (event, path: unknown) => {
        checkSender(event);
        return getProject(path);
    });
    contents.ipc.handle(projectChannels.save, (event, path: unknown, project: Project) => {
        checkSender(event);
        return saveProject(path, project);
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