import * as settingsAPI from "./settings";
import * as settings from "./settings.svelte";
import * as dialogsAPI from "./dialogs";
import * as dialogs from "./dialogs.svelte";

export async function prepareSettingsForQuit(): Promise<boolean> {
    if (!await settingsAPI.commitDrafts()) return false;
    while (!await settingsAPI.flushAccepted()) {
        const error = settings.getError();
        if (!error) return false;
        const choice = await new Promise<dialogs.SettingsSaveChoice>(resolve => {
            dialogsAPI.show({ kind: "settings-save-failure", purpose: "quit", error, answer: resolve, onClosed: () => resolve("cancel") });
        });
        if (choice === "cancel") return false;
        // The caller still runs the project-save confirmation and main task cleanup.
        if (choice === "discard") return true;
        if (!await settingsAPI.commitDrafts()) return false;
    }
    return true;
}