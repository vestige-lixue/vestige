export type SaveChoice = "save" | "discard" | "cancel" | "memory" | "retry";

export const saveConfirmation = $state<{
    fileName: string | null;
    error: string | null;
}>({ fileName: null, error: null });
let pending: Promise<SaveChoice> | null = null;
let finish: ((choice: SaveChoice) => void) | null = null;

export function confirmSave(fileName: string, error: string | null = null): Promise<SaveChoice> {
    if (pending) return pending;
    saveConfirmation.fileName = fileName;
    saveConfirmation.error = error;
    pending = new Promise(resolve => {
        finish = resolve;
    });
    return pending;
}

export function answerSave(choice: SaveChoice): void {
    const resolve = finish;
    finish = null;
    pending = null;
    saveConfirmation.fileName = null;
    saveConfirmation.error = null;
    resolve?.(choice);
}