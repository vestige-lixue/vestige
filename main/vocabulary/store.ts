import { copyFile, readFile } from "node:fs/promises";
import typia from "typia";
import { type VocabularyFile, type VocabularyRule, type VocabularyChange, type VocabularySnapshot, type VocabularyResult, type VocabularyFailure, type VocabularyFileResult, vocabularyRuleIssue, vocabularyRuleKey } from "../../shared/vocabulary/Vocabulary";
import { VestigeErrors, type FailureInfo, isExpectedFailure, toFailureInfo } from "../../shared/failure";
import { errorCode, fileOperationFailure, statOrNull, writeFileAtomic } from "../util/fs";

export async function readVocabulary(path: string): Promise<VocabularyFile> {
    let text: string;
    try {
        text = await readFile(path, "utf8");
    }
    catch (error) {
        throw new VestigeErrors(fileOperationFailure(error as NodeJS.ErrnoException, "read", path), { cause: error });
    }
    let value: unknown;
    try {
        value = JSON.parse(text.replace(/^\uFEFF/u, ""));
    }
    catch {
        throw new VestigeErrors({ kind: "vocabulary-invalid-file" });
    }
    if (!typia.equals<VocabularyFile>(value) || value.rules.some(vocabularyRuleIssue)
        || new Set(value.rules.map(rule => rule.id.toLowerCase())).size !== value.rules.length) {
        throw new VestigeErrors({ kind: "vocabulary-invalid-file" });
    }
    return value;
}

export class VocabularyStore {
    private snapshot: VocabularySnapshot = { rules: [], revision: 0, error: null };
    private loaded = false;
    private pending: Promise<unknown> = Promise.resolve();
    private readonly listeners = new Set<(snapshot: VocabularySnapshot) => void>();

    constructor(readonly path: string) {}

    private queue<T>(operation: () => Promise<T>): Promise<T> {
        const pending = this.pending.then(operation);
        this.pending = pending.catch(() => {});
        return pending;
    }

    private request<T extends VocabularyResult>(operation: () => Promise<T>): Promise<T | VocabularyFailure> {
        return this.queue(async () => {
            try {
                return await operation();
            }
            catch (error) {
                return { success: false, error: toFailureInfo(error) };
            }
        });
    }

    private broadcast(): void {
        for (const listener of this.listeners) listener(this.snapshot);
    }

    private async save(rules: VocabularyRule[]): Promise<void> {
        try {
            await writeFileAtomic(this.path, JSON.stringify({ version: 1, rules } satisfies VocabularyFile, null, 4), { sync: true, mode: undefined });
        }
        catch (error) {
            throw new VestigeErrors(fileOperationFailure(error as NodeJS.ErrnoException, "write", this.path), { cause: error });
        }
        this.snapshot = { rules, revision: this.snapshot.revision + 1, error: null };
        this.broadcast();
    }

    private async load(): Promise<void> {
        if (this.loaded && !this.snapshot.error) return;
        try {
            const file = await readVocabulary(this.path);
            const keys = new Set<string>();
            const rules: VocabularyRule[] = [];
            for (const rule of file.rules) {
                const key = vocabularyRuleKey(rule);
                if (keys.has(key)) continue;
                keys.add(key);
                rules.push({ ...rule, id: rule.id.toLowerCase() });
            }
            this.snapshot = { rules, revision: this.snapshot.revision + 1, error: null };
        }
        catch (error) {
            if (error instanceof Error && errorCode(error.cause) === "ENOENT") {
                this.snapshot = { rules: [], revision: this.snapshot.revision + 1, error: null };
            }
            else if (isExpectedFailure(error)) this.snapshot = { ...this.snapshot, error: error.failure };
            else throw error;
        }
        this.loaded = true;
    }

    get(): Promise<VocabularySnapshot> {
        return this.queue(async () => {
            await this.load();
            return this.snapshot;
        });
    }

    subscribe(listener: (snapshot: VocabularySnapshot) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    settle(): Promise<unknown> {
        return this.pending;
    }

    backupAndReset(revision: unknown, selectPath: () => Promise<string | null>): Promise<VocabularyFileResult> {
        return this.request<VocabularyFileResult>(async () => {
            if (revision !== this.snapshot.revision || !this.snapshot.error) return { success: false, error: { kind: "vocabulary-conflict" } };
            const source = await statOrNull(this.path);
            if (!source) {
                await this.load();
                if (this.snapshot.error) return { success: false, error: this.snapshot.error };
                this.broadcast();
            }
            else {
                const backup = await selectPath();
                if (!backup) return { success: true, canceled: true, snapshot: this.snapshot };
                // A backup pointing at the live file (including a link) would be lost during the reset.
                const destination = await statOrNull(backup);
                if (destination && source.dev === destination.dev && source.ino === destination.ino) {
                    return { success: false, error: { kind: "vocabulary-backup-path" } };
                }
                try {
                    await copyFile(this.path, backup);
                }
                catch (error) {
                    return { success: false, error: fileOperationFailure(error as NodeJS.ErrnoException, "write", backup) };
                }
                await this.save([]);
            }
            return { success: true, canceled: false, snapshot: this.snapshot };
        });
    }

    change(revision: unknown, change: unknown): Promise<VocabularyResult> {
        return this.request<VocabularyResult>(async () => {
            await this.load();
            const failed = (error: FailureInfo): VocabularyResult => ({ success: false, error });
            if (this.snapshot.error) return failed(this.snapshot.error);
            if (!Number.isSafeInteger(revision) || !typia.equals<VocabularyChange>(change)) return failed({ kind: "vocabulary-invalid-rule" });
            if (revision !== this.snapshot.revision) return failed({ kind: "vocabulary-conflict" });
            const current = this.snapshot.rules;
            let rules: VocabularyRule[];
            if (change.kind === "save") {
                const rule = { ...change.rule, id: change.rule.id.toLowerCase() };
                if (vocabularyRuleIssue(rule)) return failed({ kind: "vocabulary-invalid-rule" });
                const key = vocabularyRuleKey(rule);
                if (current.some(item => item.id !== rule.id && vocabularyRuleKey(item) === key)) return failed({ kind: "vocabulary-duplicate-rule" });
                const existing = current.findIndex(item => item.id === rule.id);
                rules = [...current];
                if (existing < 0) rules.push(rule);
                else rules[existing] = rule;
            }
            else {
                if (!current.some(rule => rule.id === change.id)) return failed({ kind: "vocabulary-conflict" });
                rules = current.filter(rule => rule.id !== change.id);
            }
            await this.save(rules);
            return { success: true, snapshot: this.snapshot };
        });
    }
}