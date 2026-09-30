import { dialog, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { getProject, saveProject } from "./file";
import { type Project } from "../../shared/project/Project";
import { projectChannels } from "../../shared/ipc";

export function registerProjectIPCs(window: BrowserWindow): void {
    const contents = window.webContents;
    const filters = [{ name: "Vestige Project", extensions: ["vestige"] }];
    const checkSender = (event: IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new Error("Project access is only available to the main frame.");
    };
    contents.ipc.handle(projectChannels.get, (event, path: string) => {
        checkSender(event);
        return getProject(path);
    });
    contents.ipc.handle(projectChannels.save, (event, path: string, project: Project) => {
        checkSender(event);
        return saveProject(path, project);
    });
    contents.ipc.handle(projectChannels.openDialog, async event => {
        checkSender(event);
        const result = await dialog.showOpenDialog(window, { filters, properties: ["openFile"] });
        return result.canceled ? null : result.filePaths[0] ?? null;
    });
    contents.ipc.handle(projectChannels.saveDialog, async (event, path: string | null) => {
        checkSender(event);
        const result = await dialog.showSaveDialog(window, {
            filters,
            defaultPath: typeof path === "string" && path ? path : "Untitled.vestige",
            properties: ["showOverwriteConfirmation"]
        });
        // Use the exact confirmed path; appending an extension afterwards could
        // overwrite a different file that the native dialog never confirmed.
        return result.canceled ? null : result.filePath || null;
    });
}