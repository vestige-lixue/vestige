import { type Config } from "../../shared/transcription/Config";
import * as dialogs from "./dialogs.svelte";

export function show(descriptor: dialogs.DialogDescriptor): string {
    const id = crypto.randomUUID();
    dialogs.state.dialogs.push({ ...descriptor, id, open: true });
    return id;
}

export function close(id: string): void {
    // A request only: Modal keeps the content visible until its guard approves.
    const dialog = dialogs.state.dialogs.find(dialog => dialog.id === id);
    if (dialog) dialog.open = false;
}

export function remove(id: string): void {
    const current = dialogs.state.dialogs.find(dialog => dialog.id === id);
    if (!current || current.open) return;
    // Cascade only after approval and closing animation. Remove the entire tree
    // before callbacks, so re-entrant callbacks or exceptions cannot leave orphans.
    const removed: dialogs.ApplicationDialog[] = [];
    const collect = (dialog: dialogs.ApplicationDialog): void => {
        for (const child of dialogs.state.dialogs.filter(child => child.parentId === dialog.id)) collect(child);
        removed.push(dialog);
    };
    collect(current);
    const ids = new Set(removed.map(dialog => dialog.id));
    dialogs.state.dialogs = dialogs.state.dialogs.filter(dialog => !ids.has(dialog.id));
    for (const dialog of removed) {
        try {
            dialog.onClosed?.();
        }
        catch (error) {
            console.error("The dialog close callback failed.", error);
        }
    }
}

export function showTranscriptionPresets(parentId?: string, onApply?: (name: string, config: Config) => void, selectedName?: string): string {
    const existing = dialogs.state.dialogs.find(dialog => dialog.kind === "transcription-presets");
    if (existing) return existing.id;
    return show({ kind: "transcription-presets", parentId, onApply, selectedName });
}