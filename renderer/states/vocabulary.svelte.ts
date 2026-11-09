import { type VocabularySnapshot } from "../../shared/vocabulary/Vocabulary";
import { VocabularyIndex, type VocabularyMatch } from "../../shared/vocabulary/match";

let snapshot = $state.raw<VocabularySnapshot>({ rules: [], revision: -1, error: null });
const index = $derived(new VocabularyIndex(snapshot.rules));
export const operation = $state({ busy: false });

export function getSnapshot(): VocabularySnapshot {
    return snapshot;
}

export function accept(next: VocabularySnapshot): void {
    if (next.revision >= snapshot.revision) snapshot = next;
}

export function matches(text: string, from: number, to: number): VocabularyMatch[] {
    return snapshot.error ? [] : index.find(text, from, to);
}