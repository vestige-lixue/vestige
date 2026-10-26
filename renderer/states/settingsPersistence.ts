import * as settingsAPI from "./settings";
import * as settings from "./settings.svelte";
import * as dialogsAPI from "./dialogs";
import * as dialogs from "./dialogs.svelte";

// Commit drafts and flush the accepted revision. On a write failure, ask until it is saved,
// left unsaved ("continue": the caller closes or quits anyway), or cancelled.
export async function persistSettings(purpose: "close" | "quit", commit: () => Promise<boolean>, parentId?: string): Promise<boolean> {
    while (await commit()) {
        if (await settingsAPI.flushAccepted()) return true;
        const error = settings.getError();
        if (!error) return false;
        const choice = await new Promise<dialogs.SettingsSaveChoice>(resolve => {
            dialogsAPI.show({ kind: "settings-save-failure", purpose, parentId, error, answer: resolve, onClosed: () => resolve("cancel") });
        });
        if (choice === "cancel") return false;
        if (choice === "continue") return true;
    }
    return false;
}

export function prepareSettingsForQuit(): Promise<boolean> {
    // The caller still runs the project-save confirmation and main task cleanup.
    return persistSettings("quit", settingsAPI.commitDrafts);
}