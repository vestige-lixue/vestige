import { type VocabularySnapshot } from "../../shared/vocabulary/Vocabulary";

let snapshot = $state.raw<VocabularySnapshot>({ rules: [], revision: -1, error: null });
export const operation = $state({ busy: false });

export function getSnapshot(): VocabularySnapshot {
    return snapshot;
}

export function accept(next: VocabularySnapshot): void {
    if (next.revision >= snapshot.revision) snapshot = next;
}