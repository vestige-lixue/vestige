import { type Config } from "../../shared/transcription/Config";
import * as dialogs from "./dialogs.svelte";

export function show(descriptor: dialogs.DialogDescriptor): string {
    const id = crypto.randomUUID();
    dialogs.state.dialogs.push(Object.assign(descriptor, { id, open: true }));
    return id;
}

export function close(id: string): void {
    const dialog = dialogs.state.dialogs.find(dialog => dialog.id === id);
    if (dialog) dialog.open = false;
}

export function remove(id: string): void {
    // Cascade only after the parent accepted closing; a form may reject the request.
    for (const child of dialogs.state.dialogs.filter(dialog => dialog.parentId === id)) {
        remove(child.id);
        child.onClosed();
    }
    const index = dialogs.state.dialogs.findIndex(dialog => dialog.id === id);
    if (index >= 0) dialogs.state.dialogs.splice(index, 1);
}

export function showTranscriptionPresets(parentId?: string, onApply?: (name: string, config: Config) => void, selectedName?: string): string {
    const existing = dialogs.state.dialogs.find(dialog => dialog.kind === "transcription-presets");
    if (existing) return existing.id;
    return show({ kind: "transcription-presets", parentId, onApply, selectedName, onClosed: () => {} });
}