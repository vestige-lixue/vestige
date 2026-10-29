import { app, type WebContents } from "electron";
import { appChannels } from "../shared/ipc";
import { type EditAction } from "../shared/app";
import { type LogDirectory } from "./logging";
import { handle, listen } from "./util/ipc";
import { type OperationResult } from "../shared/failure";
import { isSystemError } from "./util/file";
import { fileOperationFailure } from "./util/fs";

export function registerAppIPCs(contents: WebContents, logs: LogDirectory): void {
    listen(contents, appChannels.edit, (action: unknown) => {
        if (typeof action !== "string" || !["selectAll", "undo", "redo", "cut", "copy", "paste"].includes(action)) return;
        contents[action as EditAction]();
    });
    handle(contents, appChannels.clearLogs, (): OperationResult => {
        try {
            logs.clear();
            return { success: true };
        }
        catch (error) {
            if (isSystemError(error)) return { success: false, error: fileOperationFailure(error, "clear-logs", error.path ?? null) };
            throw error;
        }
    });
    listen(contents, appChannels.openDevTools, () => {
        contents.openDevTools({ mode: "undocked" });
    });
    listen(contents, appChannels.quit, () => {
        app.quit();
    });
}