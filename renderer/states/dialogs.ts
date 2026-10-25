import { type Config } from "../../shared/transcription/Config";
import * as dialogs from "./dialogs.svelte";

const closeRequests = new Map<string, { result: Promise<boolean>; finish: (accepted: boolean) => void }>();

export function show(descriptor: dialogs.DialogDescriptor): string {
    const id = crypto.randomUUID();
    dialogs.state.dialogs.push({ ...descriptor, id, open: true });
    return id;
}

export function setOpen(id: string, open: boolean): void {
    const dialog = dialogs.state.dialogs.find(dialog => dialog.id === id);
    if (dialog) dialog.open = open;
}

export function close(id: string): void {
    // A request only: Modal keeps the content visible until its guard approves.
    setOpen(id, false);
}

// Wait for normal guard approval and final removal; rejection keeps the dialog
// visible. Settings use this before restoring focus to an invalid parent draft.
export function requestClose(id: string): Promise<boolean> {
    const existing = closeRequests.get(id);
    if (existing) return existing.result;
    if (!dialogs.state.dialogs.some(dialog => dialog.id === id)) return Promise.resolve(true);
    let finish!: (accepted: boolean) => void;
    const result = new Promise<boolean>(resolve => finish = resolve);
    closeRequests.set(id, { result, finish });
    close(id);
    return result;
}

export function rejectClose(id: string): void {
    closeRequests.get(id)?.finish(false);
    closeRequests.delete(id);
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
        closeRequests.get(dialog.id)?.finish(true);
        closeRequests.delete(dialog.id);
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