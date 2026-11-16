import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import typia from "typia";
import { VestigeErrors, isExpectedFailure } from "../../shared/failure";
import { type VocabularyFile, type VocabularyRule, vocabularyRuleIssue } from "../../shared/vocabulary/Vocabulary";
import { fileOperationFailure, writeFileAtomic } from "../util/fs";
import { checkVersion, decodeUTF8, parseJSON, structureError } from "../util/data";

async function readText(path: string): Promise<string> {
    let bytes: Buffer;
    try {
        bytes = await readFile(path);
    }
    catch (error) {
        throw new VestigeErrors(fileOperationFailure(error as NodeJS.ErrnoException, "read", path), { cause: error });
    }
    return decodeUTF8(bytes);
}

const ruleExpectations = {
    emptySource: { field: "source", expected: "a nonempty string" },
    multilineSource: { field: "source", expected: "a single line" },
    multilineReplacement: { field: "replacement", expected: "a single line" },
    unchanged: { field: "replacement", expected: "text different from the source" }
} as const;

function validatedVocabulary(value: unknown): VocabularyFile {
    checkVersion("vocabulary", value, 1 satisfies VocabularyFile["version"]);
    const checked = typia.assertEquals<VocabularyFile>(value, props => structureError("vocabulary", props));
    const ids = new Set<string>();
    checked.rules.forEach((rule, index) => {
        const issue = vocabularyRuleIssue(rule);
        if (issue) {
            const { field, expected } = ruleExpectations[issue];
            throw new VestigeErrors({ kind: "invalid-structure", path: `vocabulary.rules[${index}].${field}`, expected });
        }
        const id = rule.id.toLowerCase();
        if (ids.has(id)) throw new VestigeErrors({ kind: "invalid-structure", path: `vocabulary.rules[${index}].id`, expected: "an id unique within the vocabulary" });
        ids.add(id);
    });
    return checked;
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
        // A JSON export can have any confirmed filename. A literal TSV source can also begin with a brace.
        const tabular = extension === ".tsv" || extension === ".txt" || /^[^\r\n]*\t/u.test(text);
        try {
            return { rules: validatedVocabulary(parseJSON(text)).rules, skipped: 0 };
        }
        catch (error) {
            if (!isExpectedFailure(error) || error.failure.kind !== "invalid-json" || extension === ".json" || !tabular) throw error;
        }
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