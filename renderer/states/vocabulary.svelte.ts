import { type VocabularySnapshot } from "../../shared/vocabulary/Vocabulary";
import { VocabularyIndex, type VocabularyGroup } from "../../shared/vocabulary/match";

let snapshot = $state.raw<VocabularySnapshot>({ rules: [], revision: -1, error: null });
const index = $derived(new VocabularyIndex(snapshot.rules));
export const operation = $state({ busy: false });

export function getSnapshot(): VocabularySnapshot {
    return snapshot;
}

export function accept(next: VocabularySnapshot): void {
    if (next.revision >= snapshot.revision) snapshot = next;
}

export function replacements(text: string, from: number, to: number): VocabularyGroup[] {
    return snapshot.error ? [] : index.replacements(text, from, to);
}