import { type EditAction } from "../shared/app";
import { handleTranscriptEdit, isTranscriptEditorTarget, transcriptEditAvailable, transcriptEditorTarget } from "./editor/transcript";

function editTarget(target: HTMLElement | null): HTMLElement | null {
    if (target && (target.matches("input, textarea") || target.isContentEditable || isTranscriptEditorTarget(target))) return target;
    return transcriptEditorTarget();
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
    if (action === "cut" || action === "copy") {
        if (action === "cut" && !editable) return false;
        if (input) return !target.disabled && target.selectionStart !== null && target.selectionEnd !== null && target.selectionStart !== target.selectionEnd;
        const selection = document.getSelection();
        return !!selection && !selection.isCollapsed && !!selection.toString();
    }
    return !!editable && document.queryCommandEnabled(action);
}

export function runEdit(target: HTMLElement | null, action: EditAction, nativeFallback = true): boolean {
    if (handleTranscriptEdit(editTarget(target), action)) return true;
    // Other text inputs retain the browser's native editing/clipboard behavior.
    if (!nativeFallback) return false;
    window.api.edit(action);
    return true;
}