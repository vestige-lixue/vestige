import { dialog, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { getProject, saveProject } from "./file";
import { type Project } from "../../shared/project/Project";
import { projectChannels } from "../../shared/ipc";
import { filePath } from "../util/file";

export function registerProjectIPCs(window: BrowserWindow): void {
    const contents = window.webContents;
    const filters = [{ name: "Vestige Project", extensions: ["vestige"] }];
    const checkSender = (event: IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new Error("Project access is only available to the main frame.");
    };
    contents.ipc.handle(projectChannels.get, (event, path: unknown) => {
        checkSender(event);
        return getProject(path);
    });
    contents.ipc.handle(projectChannels.save, (event, path: unknown, project: Project) => {
        checkSender(event);
        return saveProject(path, project);
    });
    contents.ipc.handle(projectChannels.openDialog, async event => {
        checkSender(event);
        const result = await dialog.showOpenDialog(window, { filters, properties: ["openFile"] });
        return result.canceled || !result.filePaths[0] ? null : filePath(result.filePaths[0]);
    });
    contents.ipc.handle(projectChannels.saveDialog, async (event, path: unknown) => {
        checkSender(event);
        const result = await dialog.showSaveDialog(window, {
            filters,
            defaultPath: path == null ? "Untitled.vestige" : filePath(path),
            properties: ["showOverwriteConfirmation"]
        });
        // Use the exact confirmed path; appending an extension afterwards could
        // overwrite a different file that the native dialog never confirmed.
        return result.canceled || !result.filePath ? null : filePath(result.filePath);
    });
}