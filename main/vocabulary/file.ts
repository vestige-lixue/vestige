import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import typia from "typia";
import { VestigeErrors } from "../../shared/failure";
import { type VocabularyFile, type VocabularyRule, vocabularyRuleIssue } from "../../shared/vocabulary/Vocabulary";
import { fileOperationFailure, writeFileAtomic } from "../util/fs";

async function readText(path: string): Promise<string> {
    let bytes: Buffer;
    try {
        bytes = await readFile(path);
    }
    catch (error) {
        throw new VestigeErrors(fileOperationFailure(error as NodeJS.ErrnoException, "read", path), { cause: error });
    }
    try {
        // TextDecoder consumes the optional UTF-8 BOM and preserves every subsequent character.
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch {
        throw new VestigeErrors({ kind: "vocabulary-invalid-file" });
    }
}

function parseJSON(text: string): unknown {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}

function validatedVocabulary(value: unknown): VocabularyFile {
    if (!typia.equals<VocabularyFile>(value) || value.rules.some(vocabularyRuleIssue)
        || new Set(value.rules.map(rule => rule.id.toLowerCase())).size !== value.rules.length) {
        throw new VestigeErrors({ kind: "vocabulary-invalid-file" });
    }
    return value;
}

export async function readVocabulary(path: string): Promise<VocabularyFile> {
    return validatedVocabulary(parseJSON(await readText(path)));
}

export async function writeVocabulary(path: string, rules: VocabularyRule[]): Promise<void> {
    try {
        await writeFileAtomic(path, JSON.stringify({ version: 1, rules } satisfies VocabularyFile, null, 4), { sync: true, mode: undefined });
    }
    catch (error) {
        throw new VestigeErrors(fileOperationFailure(error as NodeJS.ErrnoException, "write", path), { cause: error });
    }
}

export async function readVocabularyImport(path: string): Promise<{ rules: Omit<VocabularyRule, "id">[]; skipped: number }> {
    const text = await readText(path);
    const extension = extname(path).toLowerCase();
    if (extension === ".json" || /^\s*(?:\{|\[)/u.test(text)) {
        const json = parseJSON(text);
        // A JSON export can have any confirmed filename. A literal TSV source can also begin with a brace.
        if (json !== undefined || extension === ".json" || !text.includes("\t")) return { rules: validatedVocabulary(json).rules, skipped: 0 };
    }
    const rules: Omit<VocabularyRule, "id">[] = [];
    let skipped = 0;
    for (const line of text.split(/\r?\n/u)) {
        if (!line.length) continue;
        const fields = line.split("\t");
        if (fields.length === 2) rules.push({ source: fields[0], replacement: fields[1], enabled: true });
        else skipped++;
    }
    return { rules, skipped };
}