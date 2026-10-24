import { type EditAction } from "../shared/app";
import { handleTranscriptEdit, transcriptHistoryAvailable } from "./editor/transcript";

export function editAvailable(target: HTMLElement | null, action: EditAction): boolean {
    if (action !== "undo" && action !== "redo") return true;
    const transcript = transcriptHistoryAvailable(target, action);
    // false belongs to an editor with no history; only null permits native fallback.
    if (transcript !== null) return transcript;
    const editable = target && (target.isContentEditable
        || (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && !target.readOnly && !target.disabled);
    return !!editable && document.queryCommandEnabled(action);
}

export function runEdit(target: HTMLElement | null, action: EditAction, nativeFallback = true): boolean {
    if (handleTranscriptEdit(target, action)) return true;
    // Keyboard input retains the browser's native editing/clipboard behavior.
    if (!nativeFallback) return false;
    window.api.edit(action);
    return true;
}