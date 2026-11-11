import { type tags } from "typia";
import { type FailureInfo } from "../failure";

export type VocabularyRule = {
    id: string & tags.Format<"uuid">;
    source: string;
    replacement: string;
    enabled: boolean;
};

export type VocabularyFile = { version: 1; rules: VocabularyRule[] };
export type VocabularySnapshot = {
    rules: VocabularyRule[];
    revision: number;
    error: FailureInfo | null;
};
export type VocabularyChange =
    | { kind: "save"; rule: VocabularyRule }
    | { kind: "remove"; id: string };
export type VocabularyFailure = { success: false; error: FailureInfo };
export type VocabularyResult = { success: true; snapshot: VocabularySnapshot } | VocabularyFailure;
export type VocabularyFileResult<T = unknown> = VocabularyFailure
    | { success: true; canceled: true; snapshot: VocabularySnapshot }
    | ({ success: true; canceled: false; snapshot: VocabularySnapshot } & T);

export type VocabularyImportResult = VocabularyFileResult<{ imported: number; skipped: number }>;

export const vocabularyLineBreak = /[\r\n\u2028\u2029]/u;

export function vocabularyRuleIssue(rule: Pick<VocabularyRule, "source" | "replacement">): "emptySource" | "multilineSource" | "multilineReplacement" | "unchanged" | null {
    if (vocabularyLineBreak.test(rule.source)) return "multilineSource";
    if (rule.source === "") return "emptySource";
    if (vocabularyLineBreak.test(rule.replacement)) return "multilineReplacement";
    return rule.source === rule.replacement ? "unchanged" : null;
}

export function vocabularyRuleKey(rule: Pick<VocabularyRule, "source" | "replacement">): string {
    return JSON.stringify([rule.source, rule.replacement]);
}