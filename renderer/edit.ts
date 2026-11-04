import { type EditAction } from "../shared/app";
import { handleTranscriptEdit, handleTranscriptMenuEdit, isTranscriptEditorTarget, transcriptEditAvailable, transcriptEditorTarget } from "./editor/transcript";

const editStateListeners = new Set<() => void>();

export function onEditStateChanged(listener: () => void): () => void {
    editStateListeners.add(listener);
    return () => {
        editStateListeners.delete(listener);
    };
}

export function notifyEditStateChanged(): void {
    for (const listener of editStateListeners) listener();
}

function editTarget(target: HTMLElement | null): HTMLElement | null {
    if (target && (target.matches("input, textarea") || target.isContentEditable || isTranscriptEditorTarget(target))) return target;
    return transcriptEditorTarget();
}

/** Whether cut or copy has selected text in the target. `queryCommandEnabled` reports false for both even with a selection. */
export function selectionAvailable(target: HTMLElement | null): boolean {
    const input = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if (input && target.disabled) return false;
    // type="number" and similar inputs have no selection API, but the document selection reports their selected text while focused.
    if (input && target.selectionStart !== null && target.selectionEnd !== null) return target.selectionStart !== target.selectionEnd;
    if (input && document.activeElement !== target) return false;
    const selection = document.getSelection();
    return !!selection && (input || !selection.isCollapsed) && !!selection.toString();
}

export function editAvailable(element: HTMLElement | null, action: EditAction): boolean {
    const target = editTarget(element);
    const transcript = transcriptEditAvailable(target, action);
    // A recognized transcript owns availability; only null permits native fallback.
    if (transcript !== null) return transcript;
    if (action !== "undo" && action !== "redo" && action !== "cut" && action !== "copy") return true;
    const input = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    const editable = target && (target.isContentEditable
        || input && !target.readOnly && !target.disabled);
    if (action === "cut" || action === "copy") return (action === "copy" || !!editable) && selectionAvailable(target);
    return !!editable && document.queryCommandEnabled(action);
}

export function runEdit(target: HTMLElement | null, action: EditAction, nativeFallback = true): boolean {
    if (handleTranscriptMenuEdit(editTarget(target), action)) return true;
    if (handleTranscriptEdit(editTarget(target), action)) return true;
    // Other text inputs retain the browser's native editing/clipboard behavior.
    if (!nativeFallback) return false;
    window.api.edit(action);
    return true;
}