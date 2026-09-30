export type SaveChoice = "save" | "discard" | "cancel";

export const saveConfirmation = $state<{ fileName: string | null }>({ fileName: null });
let pending: Promise<SaveChoice> | null = null;
let finish: ((choice: SaveChoice) => void) | null = null;

export function confirmSave(fileName: string): Promise<SaveChoice> {
    if (pending) return pending;
    saveConfirmation.fileName = fileName;
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
    resolve?.(choice);
}