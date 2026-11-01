import { type EditAction } from "../shared/app";
import { handleTranscriptEdit, transcriptEditAvailable } from "./editor/transcript";

export function editAvailable(target: HTMLElement | null, action: EditAction): boolean {
    if (action !== "undo" && action !== "redo" && action !== "cut" && action !== "copy") return true;
    const transcript = transcriptEditAvailable(target, action);
    // A recognized transcript owns availability; only null permits native fallback.
    if (transcript !== null) return transcript;
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
    if (handleTranscriptEdit(target, action)) return true;
    // Keyboard input retains the browser's native editing/clipboard behavior.
    if (!nativeFallback) return false;
    window.api.edit(action);
    return true;
}