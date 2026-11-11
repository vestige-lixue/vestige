import { type VocabularyChange, type VocabularyResult, type VocabularyFailure, type VocabularyFileResult } from "../../shared/vocabulary/Vocabulary";
import { toFailureInfo } from "../../shared/failure";
import * as vocabulary from "./vocabulary.svelte";

export async function reload(): Promise<void> {
    try {
        vocabulary.accept(await window.api.vocabulary.get());
    }
    catch (error) {
        vocabulary.accept({ ...vocabulary.getSnapshot(), error: toFailureInfo(error) });
    }
}

export async function initialize(): Promise<void> {
    const unsubscribe = window.api.vocabulary.onChanged(vocabulary.accept);
    import.meta.hot?.dispose(unsubscribe);
    await reload();
}

export function change(value: VocabularyChange, revision = vocabulary.getSnapshot().revision): Promise<VocabularyResult> {
    return request(() => window.api.vocabulary.change(revision, value));
}

export function backupAndReset(): Promise<VocabularyFileResult> {
    return request(() => window.api.vocabulary.backupAndReset(vocabulary.getSnapshot().revision));
}

async function request<T extends VocabularyResult>(operation: () => Promise<T>): Promise<T | VocabularyFailure> {
    if (vocabulary.operation.busy) return { success: false, error: { kind: "vocabulary-conflict" } };
    vocabulary.operation.busy = true;
    try {
        const result = await operation();
        if (result.success) vocabulary.accept(result.snapshot);
        else if (result.error.kind === "vocabulary-conflict") await reload();
        return result;
    }
    catch (error) {
        return { success: false, error: toFailureInfo(error) };
    }
    finally {
        vocabulary.operation.busy = false;
    }
}