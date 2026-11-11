import { type VocabularyRule } from "../../shared/vocabulary/Vocabulary";

export function rule(source: string, replacement = "替换", enabled = true): VocabularyRule {
    return { id: crypto.randomUUID(), source, replacement, enabled };
}