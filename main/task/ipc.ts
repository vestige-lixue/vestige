import { type WebContents } from "electron";
import { taskOutputChannels } from "../../shared/task";
import { TaskOutputStore } from "./store";
import { type LogDirectory } from "../logging";
import { handle } from "../util/ipc";

export function registerTaskOutputIPCs(contents: WebContents, logs: LogDirectory): TaskOutputStore {
    const tasks = new TaskOutputStore(snapshot => {
        if (!contents.isDestroyed()) contents.send(taskOutputChannels.changed, snapshot);
    }, logs);
    handle(contents, taskOutputChannels.get, (id: unknown) => {
        if (typeof id !== "string" || id.length > 128) return null;
        return tasks.get(id);
    });
    contents.once("destroyed", () => tasks.dispose());
    return tasks;
}