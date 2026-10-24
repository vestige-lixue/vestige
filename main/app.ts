import { app, type WebContents } from "electron";
import { appChannels } from "../shared/ipc";
import { type EditAction } from "../shared/app";
import { VestigeErrors } from "../shared/failure";
import { type LogDirectory } from "./logging";

export function registerAppIPCs(contents: WebContents, logs: LogDirectory): void {
    contents.ipc.on(appChannels.edit, (event, action: unknown) => {
        if (event.senderFrame !== contents.mainFrame || typeof action !== "string"
            || !["selectAll", "undo", "redo", "cut", "copy", "paste"].includes(action)) return;
        contents[action as EditAction]();
    });
    contents.ipc.handle(appChannels.clearLogs, event => {
        if (event.senderFrame !== contents.mainFrame) throw new VestigeErrors({ kind: "ipc-not-main-frame" });
        logs.clear();
    });
    contents.ipc.on(appChannels.openDevTools, event => {
        if (event.senderFrame !== contents.mainFrame) return;
        contents.openDevTools({ mode: "detach" });
    });
    contents.ipc.on(appChannels.quit, event => {
        if (event.senderFrame !== contents.mainFrame) return;
        app.quit();
    });
}