import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { mkdtempSync, writeFileSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import { join } from "node:path";
import { exportPlainText, exportSrt, type SrtOptions } from "../shared/transcript/export";
import { timeText, type TimedText as CharacterTiming } from "../shared/transcript/export/timing";
import { cueRanges } from "../shared/transcript/export/cues";
import { textLayout } from "../shared/transcript/export/breaks";
import { characterWidth } from "../shared/transcript/width";
import { createTextIndex, editText, projectText } from "../shared/transcript/text";
import { defaultSettings } from "../shared/settings/defaults";
import { modification, project, transcript } from "./support/fixtures";
import { editingArbitrary, editRange } from "./support/generators";
import { checkProperty } from "./support/properties";
import { readSettings } from "../main/settings/file";

type TimedText = [text: string, start: number, end: number];
type Edit = [from: number, to: number, text: string];
type Cue = { start: number; end: number; lines: string[] };
type ExportFixture = {
    spans: ReturnType<typeof transcript>;
    index: ReturnType<typeof createTextIndex>;
    projection: ReturnType<typeof projectText>;
    srt: (options?: Partial<SrtOptions>, duration?: number, language?: string) => ReturnType<typeof exportSrt>;
};
const unlimited: SrtOptions = { ...defaultSettings.export.srt, maxLineWidth: null, pauseSeconds: null, maxDurationSeconds: null, minDurationSeconds: 0 };

function fixture(items: TimedText[], edits: Edit[] = []): ExportFixture {
    const spans = transcript(items.map(([text]) => text));
    spans.forEach((span, i) => span.range = { start: items[i][1], end: items[i][2] });
    const index = createTextIndex(spans);
    const projection = projectText(index, edits.flatMap(edit => modification(spans, ...edit)));
    return {
        spans, index, projection,
        srt: (options: Partial<SrtOptions> = {}, duration = Math.max(0, ...items.map(([, , end]) => end)), language?: string) =>
            exportSrt(index, projection, duration, { ...unlimited, ...options }, language)
    };
}

function words(values: string[]): ExportFixture {
    return fixture(values.map((text, i) => [text, i / 10, (i + 1) / 10]));
}

// Parse the SRT grammar independently, including every blank-line separator.
function readSrt(text: string): Cue[] {
    expect(text.replace(/\r\n/gu, "")).not.toMatch(/[\r\n]/u);
    if (!text) return [];
    const timestamp = "(\\d{2,}):([0-5]\\d):([0-5]\\d),(\\d{3})";
    const timeLine = new RegExp(`^${timestamp} --> ${timestamp}$`, "u");
    return text.split("\r\n\r\n").map((block, i) => {
        const [number, time, ...lines] = block.split("\r\n");
        expect(number).toBe(String(i + 1));
        const match = timeLine.exec(time);
        expect(match).not.toBeNull();
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
            expect(line).not.toBe("");
            expect(line).toBe(line.trim());
        }
        const seconds = (offset: number): number => Number(match![offset]) * 3600 + Number(match![offset + 1]) * 60
            + Number(match![offset + 2]) + Number(match![offset + 3]) / 1000;
        return { start: seconds(1), end: seconds(5), lines };
    });
}

const texts = (result: { text: string }): string[] => readSrt(result.text).map(cue => cue.lines.join("\n"));
const times = (result: { text: string }): number[][] => readSrt(result.text).map(cue => [cue.start, cue.end]);

describe("SRT line breaks", () => {
    it.each(["\n", "\r", "\r\n"])("excludes silence when %j is inserted at its marker; leading whitespace takes no time", newline => {
        const f = fixture([["Hello", 0, 1], [" world", 1, 2], [" again", 5, 6]], [[11, 11, newline]]);
        const result = f.srt(defaultSettings.export.srt);
        expect(readSrt(result.text)).toEqual([
            { start: 0, end: 2, lines: ["Hello world"] },
            { start: 5, end: 6, lines: ["again"] }
        ]);
        expect(result.unanchored).toBe(0);
    });

    it("interpolates gap text by character width across an inserted newline", () => {
        // Newlines and whitespace no longer consume any interpolation time.
        const f = fixture([["B", 3, 4]], [[0, 0, "foo\nbar"]]);
        expect(readSrt(f.srt({ maxDurationSeconds: 1 }).text)).toEqual([
            { start: 0, end: 1.5, lines: ["foo"] }, { start: 1.5, end: 4, lines: ["barB"] }
        ]);
        expect(f.srt().estimated).toBe(true); // The nearest positive-duration characters across the newline share a gap group.
    });

    it("does not count original newline tokens or use their timing", () => {
        expect(texts(fixture([["a", 0, 1], ["\n", 2, 5], ["b", 5, 6]])
            .srt({ splitAtLineBreaks: false }))).toEqual(["a\nb"]);
        expect(times(fixture([["\n", 8, 9], ["a", 0, 1]]).srt({ splitAtLineBreaks: false }))).toEqual([[0, 1]]);
    });

    it.each(["\n\n", "\r\r", "\r\n\r\n", "\n \t\n", "\n\u3000\n", "\n\n \n\n"])("collapses blank lines in %j without consuming the line limit", newline => {
        const f = fixture([["a", 0, 1], ["b", 1, 2]], [[1, 1, newline]]);
        for (const maxLines of [2, 3]) {
            expect(readSrt(f.srt({ splitAtLineBreaks: false, maxLines }).text)).toEqual([{ start: 0, end: 2, lines: ["a", "b"] }]);
        }
    });

    it("filters leading, trailing and interior whitespace-only lines", () => {
        const f = fixture([[" \n a \n \t\n b \n ", 0, 2]]);
        expect(texts(f.srt({ splitAtLineBreaks: false }))).toEqual(["a\nb"]);
        expect(fixture([["\r\n\n", 0, 1]]).srt()).toEqual({ text: "", unanchored: 0, estimated: false });
    });
});

describe("SRT inserted text timing", () => {
    it("keeps an internally corrected word indivisible and attaches its insertion at the preceding end", () => {
        // Insertions no longer inherit a whole token's interval.
        const f = fixture([["quik", 1, 3]], [[3, 3, "c"]]);
        expect(readSrt(f.srt({ maxLineWidth: 4, maxLines: 1 }).text)).toEqual([{ start: 1, end: 3, lines: ["quick"] }]);
        expect(f.srt().unanchored).toBe(1);
    });

    it("keeps br + own together with the deleted characters' timing, even beyond the limits", () => {
        const f = fixture([["brwn", 1, 4]], [[2, 4, "own"]]);
        expect(readSrt(f.srt({ maxLineWidth: 4, maxLines: 1, maxDurationSeconds: 1 }).text))
            .toEqual([{ start: 1, end: 4, lines: ["brown"] }]);
        expect(f.srt().unanchored).toBe(0);
    });

    it("uses the silence interval for an insertion at a gap marker", () => {
        const f = fixture([["B", 2, 3]], [[0, 0, "GAP\n"]]);
        expect(readSrt(f.srt({ maxDurationSeconds: 1 }).text)).toEqual([
            { start: 0, end: 2, lines: ["GAP"] }, { start: 2, end: 3, lines: ["B"] }
        ]);
        expect(f.srt().unanchored).toBe(0);
    });

    it("attaches an unanchored insertion backward without extending its audio envelope", () => {
        const f = fixture([["A", 0, 1], ["B", 1, 2]], [[1, 1, "XYZ\n"]]);
        expect(readSrt(f.srt().text)).toEqual([
            { start: 0, end: 1, lines: ["AXYZ"] }, { start: 1, end: 2, lines: ["B"] }
        ]);
        expect(f.srt().unanchored).toBe(1);
    });

    it("attaches forward at the document start and after a newline", () => {
        const beginning = fixture([["A", 0, 1]], [[0, 0, "X"]]);
        expect(times(beginning.srt())).toEqual([[0, 1]]);
        expect(beginning.srt().unanchored).toBe(1);
        const afterBreak = fixture([["A", 0, 1], ["\n", 1, 1], ["B", 1, 2]], [[2, 2, "X"]]);
        expect(readSrt(afterBreak.srt().text)).toEqual([
            { start: 0, end: 1, lines: ["A"] }, { start: 1, end: 2, lines: ["XB"] }
        ]);
        expect(afterBreak.srt().unanchored).toBe(1);
        expect(fixture([["A", 0, 1], ["B", 1, 2]], [[1, 1, "\n"]]).srt().unanchored).toBe(0);
    });

    it("prefers replacement timing over a gap absorbed by deletion (D22)", () => {
        const f = fixture([["A", 0, 1], ["B", 3, 4]], [[0, 1, "X\n"]]);
        // Replacement newlines no longer consume time; X gets the full deleted interval.
        expect(readSrt(f.srt().text)[0]).toEqual({ start: 0, end: 1, lines: ["X"] });
    });

    it("does not split at a pause inside an indivisible replacement", () => {
        const f = fixture([["AB", 0, 1], ["CD", 3, 4]], [[1, 3, "X"]]);
        expect(texts(f.srt({ pauseSeconds: 0.5 }))).toEqual(["AXD"]);
    });
});

describe("SRT segmentation", () => {
    it("splits at all newline forms, including inside a token and across CRLF pieces", () => {
        const f = fixture([["A\r\nB\rC\nD", 1, 2]]);
        expect(texts(f.srt())).toEqual(["A", "B", "C", "D"]);
        expect(texts(f.srt({ splitAtLineBreaks: false, maxLines: 5 }))).toEqual(["A\nB\nC\nD"]);
        expect(texts(f.srt({ splitAtLineBreaks: false, maxLines: 2 }))).toEqual(["A\nB", "C\nD"]);
        expect(texts(fixture([["A\r", 0, 1], ["\nB", 1, 2]]).srt())).toEqual(["A", "B"]);
    });

    it("uses word candidates rather than the removed token-count limit", () => {
        expect(texts(words(["A", " B", " C"]).srt({ maxLineWidth: 3, maxLines: 1 }))).toEqual(["A B", "C"]);
    });

    it("uses the minimum line count and balances only at feasible word boundaries", () => {
        const f = fixture([["red ", 0, 1], ["green ", 1, 2], ["blue", 2, 3]]);
        expect(texts(f.srt({ maxLineWidth: 8, maxLines: 2 }))).toEqual(["red\ngreen", "blue"]);
        expect(texts(fixture([["longword", 0, 1]]).srt({ maxLineWidth: 4, maxLines: 1 }))).toEqual(["longword"]);
    });

    it("splits at an inclusive pause threshold and keeps deleted speech as speech", () => {
        const f = fixture([["A", 0, 1], [" ", 1, 1], ["B", 1.5, 2.5]]);
        expect(texts(f.srt({ pauseSeconds: 0.5 }))).toEqual(["A", "B"]);
        expect(texts(f.srt({ pauseSeconds: 0.6 }))).toEqual(["A B"]);
        expect(texts(fixture([["A", 0, 1], ["um", 1, 2], [" B", 2, 3]], [[1, 3, ""]]).srt({ pauseSeconds: 0.1 }))).toEqual(["A B"]);
    });

    it("splits when the combined time envelope exceeds the longest duration", () => {
        const f = fixture([["A", 0, 2], [" ", 2, 2], ["B", 2, 4]]);
        expect(texts(f.srt({ maxDurationSeconds: 3 }))).toEqual(["A", "B"]);
        expect(texts(f.srt({ maxDurationSeconds: 4 }))).toEqual(["A B"]);
    });

    it("combines capacity, pause, newline and sentence boundaries", () => {
        const f = fixture([["A B C", 0, 3], [" D E", 4, 7], ["\nF. G", 7, 10]]);
        expect(texts(f.srt({ maxLineWidth: 3, maxLines: 1, pauseSeconds: 1 }))).toEqual(["A B", "C", "D E", "F.", "G"]);
    });

    it.each([
        { name: "Chinese", text: "中".repeat(44), expected: ["中".repeat(21) + "\n" + "中".repeat(21), "中".repeat(2)] },
        { name: "English indivisible word", text: "a".repeat(90), expected: ["a".repeat(90)] },
        { name: "mixed", text: "中a".repeat(30), expected: ["中a".repeat(14) + "\n" + "中a".repeat(14), "中a".repeat(2)] }
    ])("wraps $name text at width 42 using word boundaries, never token boundaries", ({ text, expected }) => {
        const items: TimedText[] = Array.from(text, (character, i) => [character, i / 10, (i + 1) / 10]);
        expect(texts(fixture(items).srt({ maxLineWidth: 42, maxLines: 2 }))).toEqual(expected);
    });

    it("trims every line and skips empty cues with consecutive numbering", () => {
        const f = fixture([["  ", 0, 1], [" A ", 1, 2], [" \n ", 2, 3], [" B ", 3, 4], [" ", 4, 5]]);
        expect(texts(f.srt({ maxLineWidth: 1, maxLines: 1 }))).toEqual(["A", "B"]);
        expect(fixture([[" \r\n\t ", 0, 1]]).srt().text).toBe("");
    });
});

describe("SRT punctuation boundaries and balanced lines", () => {
    it("looks back to ago, and balances the remainder at the nearest feasible word boundary", () => {
        const f = words(["There", " was", " a", " day", ",", " about", " ten", " years", " ago", ",", " when", " I", " asked", " a", " friend", " to", " hold", " a", " baby", " dinosaur", " robot", " upside", " down", "."]);
        // The formal nearest-boundary rule puts the second line break after a, rather than after hold in the mockup.
        expect(texts(f.srt(defaultSettings.export.srt))).toEqual([
            "There was a day, about ten years ago,", "when I asked a friend to hold a\nbaby dinosaur robot upside down."
        ]);
    });

    it("splits sentence endings only when the option is enabled", () => {
        const f = words(["Yes", ".", " No", "."]);
        expect(texts(f.srt())).toEqual(["Yes.", "No."]);
        expect(texts(f.srt({ splitAtSentenceEnds: false }))).toEqual(["Yes. No."]);
    });

    it("prefers sentence endings over clauses and ordinary boundaries when looking back", () => {
        const options = { maxLineWidth: 10, maxLines: 1, splitAtSentenceEnds: false };
        expect(texts(words(["a", " b.", " c,", " d", " e"]).srt(options))).toEqual(["a b.", "c, d e"]);
        expect(texts(words(["a", " b,", " c", " d", " e"]).srt({ ...options, maxLineWidth: 8 }))).toEqual(["a b,", "c d e"]);
    });

    it.each([".", ","])("takes the last qualifying %s boundary in the same tier", punctuation => {
        expect(texts(words(["a", " b" + punctuation, " c" + punctuation, " d", " e", " f", " g"])
            .srt({ maxLineWidth: 13, maxLines: 1, splitAtSentenceEnds: false }))).toEqual(["a b" + punctuation + " c" + punctuation, "d e f g"]);
    });

    it("demotes punctuation below one-third fill instead of emitting a tiny cue", () => {
        const options = { maxLineWidth: 12, maxLines: 1, splitAtSentenceEnds: false };
        expect(texts(words(["a.", " b", " c", " d", " e", " f", " g"]).srt(options))).toEqual(["a. b c d e f", "g"]);
        expect(texts(words(["a.", " b,", " c", " d", " e", " f", " g"]).srt(options))).toEqual(["a. b,", "c d e f g"]);
    });

    it("retries the remaining tail until an oversized candidate can stand alone", () => {
        expect(texts(words(["A,", " B", " CCCCC"]).srt({ maxLineWidth: 4, maxLines: 1 }))).toEqual(["A,", "B", "CCCCC"]);
    });

    it.each([",", "。"])("keeps standalone %s off cue and line beginnings when an alternative exists", punctuation => {
        const result = words(["A", " B", " C", punctuation, " D"]).srt({ maxLineWidth: 5, maxLines: 1 });
        const lines = readSrt(result.text).flatMap(cue => cue.lines);
        expect(lines.every(line => !line.startsWith(punctuation))).toBe(true);
        expect(lines.join("")).toContain("C" + punctuation);
        expect(texts(words(["abc", " d", punctuation, " efg"]).srt({ maxLineWidth: 7, maxLines: 2, splitAtSentenceEnds: false })))
            .toEqual(["abc d" + punctuation + "\nefg"]);
    });

    it("keeps punctuation in an oversized candidate rather than using the old before-punctuation fallback", () => {
        expect(texts(words(["ABCD", ","]).srt({ maxLineWidth: 4, maxLines: 1 }))).toEqual(["ABCD,"]);
    });

    it("keeps a word and its punctuation together even beyond the duration limit", () => {
        const f = fixture([["doing", 51.38, 56.73], [".", 56.73, 59.97]]);
        expect(texts(f.srt({ maxDurationSeconds: 7 }))).toEqual(["doing."]);
    });

    it.each(["Yes.)", "Yes.\"", "Yes.'", "好。”", "好。】"])("recognizes sentence punctuation before trailing closing marks in %s", ending => {
        expect(texts(words([ending, " Next"]).srt())).toEqual([ending, "Next"]);
    });

    it("uses Chinese clause and sentence punctuation for both cue and line breaks", () => {
        expect(texts(words(["甲", "，", "乙", "丙", "。", "丁"]).srt({ maxLineWidth: 4, maxLines: 2 }))).toEqual(["甲，", "乙\n丙。", "丁"]);
    });

    it("balances two lines and prefers nearby punctuation over an ordinary break", () => {
        expect(texts(words(["aa", " bb", " cc", " dd"]).srt({ maxLineWidth: 8, maxLines: 2 }))).toEqual(["aa bb\ncc dd"]);
        expect(texts(words(["aaa,", " bb", " ccc"]).srt({ maxLineWidth: 8, maxLines: 2 }))).toEqual(["aaa,\nbb ccc"]);
        expect(texts(words(["a,", " bbbb", " ccc"]).srt({ maxLineWidth: 8, maxLines: 2 }))).toEqual(["a, bbbb\nccc"]);
    });

    it("falls back to greedy lines when an indivisible candidate prevents a width-safe rearrangement", () => {
        expect(texts(words(["abcdef", " g", " h"]).srt({ maxLineWidth: 4, maxLines: 2 }))).toEqual(["abcdef\ng h"]);
    });

    it("balances paragraphs independently around retained hard line breaks", () => {
        expect(texts(words(["aa", " bb", "\n", "cc", " dd"]).srt({ splitAtLineBreaks: false, maxLineWidth: 8, maxLines: 2 }))).toEqual(["aa bb\ncc dd"]);
    });

    it("computes fill from width when duration is unlimited", () => {
        expect(texts(words(["A", " B,", " CCC", " DDD", " EEE"]).srt({ maxLineWidth: 4, maxLines: 2 })))
            .toEqual(["A B,", "CCC\nDDD", "EEE"]);
    });

    it("computes fill from width and duration after removal of token counts", () => {
        const f = words(["A", " B,", " C", " D", " E"]);
        expect(texts(f.srt({ maxLineWidth: 8, maxLines: 1 }))).toEqual(["A B,", "C D E"]);
        expect(texts(f.srt({ maxLineWidth: 8, maxLines: 1, maxDurationSeconds: 60 }))).toEqual(["A B,", "C D E"]);
    });

    it("computes fill from duration when width is unlimited", () => {
        const f = fixture([["A", 0, 0.2], [" B,", 0.2, 0.5], [" C", 0.5, 0.8], [" D", 0.8, 1.1]]);
        expect(texts(f.srt({ maxDurationSeconds: 1 }))).toEqual(["A B,", "C D"]);
    });

    it("fills the missing sentence option in old export settings without resetting preferences", () => {
        const directory = mkdtempSync(join(tmpdir(), "vestige-export-settings-")), path = join(directory, "settings.json");
        try {
            const { splitAtSentenceEnds, ...srt } = defaultSettings.export.srt;
            expect(splitAtSentenceEnds).toBe(true);
            const legacy = { ...structuredClone(defaultSettings), language: "en", export: { format: "srt", srt: { ...srt, maxLineWidth: 55 } } };
            writeFileSync(path, JSON.stringify(legacy));
            const loaded = readSettings(path);
            expect(loaded.settings.language).toBe("en");
            expect(loaded.settings.export).toEqual({ format: "srt", srt: { ...legacy.export.srt, splitAtSentenceEnds: true } });
            expect(loaded.savedText).not.toBeNull();
            writeFileSync(path, JSON.stringify({ ...legacy, export: { ...legacy.export, srt: { ...legacy.export.srt, splitAtSentenceEnds: false } } }));
            expect(readSettings(path).settings.export.srt.splitAtSentenceEnds).toBe(false);
        }
        finally {
            rmSync(path, { force: true });
            rmdirSync(directory);
        }
    });

    it("preserves punctuation and word order while packing varied limits", () => {
        const pieces = fc.array(fc.constantFrom("alpha", " beta", ",", "。", " e.g.", "\"", ")", "中", " ", "\n", "abcd", "..."), { maxLength: 60 });
        checkProperty("export-punctuation-order", fc.property(pieces, fc.integer({ min: 4, max: 24 }), fc.integer({ min: 1, max: 5 }),
            fc.boolean(), fc.boolean(), (values, maxLineWidth, maxLines, splitAtLineBreaks, splitAtSentenceEnds) => {
                const result = words(values).srt({ maxLineWidth, maxLines, splitAtLineBreaks, splitAtSentenceEnds });
                const actual = readSrt(result.text).flatMap(cue => cue.lines).join("").replace(/\s/gu, "");
                expect(actual).toBe(values.join("").replace(/\s/gu, ""));
            }));
    });
});

describe("SRT word candidates and punctuation ownership", () => {
    it("defaults to no maximum cue duration", () => {
        expect(defaultSettings.export.srt.maxDurationSeconds).toBeNull();
        expect(defaultSettings.export.srt).not.toHaveProperty("tokenBasis");
        expect(defaultSettings.export.srt).not.toHaveProperty("maxTokens");
    });

    it("keeps long punctuation with its word without claiming an internal timing cut", () => {
        // A whole timing group no longer causes an estimate just because it was interpolated internally.
        const f = fixture([["doing", 51.38, 56.73], [".", 56.73, 59.97]]);
        expect(readSrt(f.srt({ maxDurationSeconds: 7 }).text)).toEqual([{ start: 51.38, end: 59.97, lines: ["doing."] }]);
        const sentence = fixture([["哦", 0, 19], ["。", 0, 19]]).srt({ maxDurationSeconds: 7 });
        expect(times(sentence)).toEqual([[0, 19]]);
        expect(sentence.estimated).toBe(false);
    });

    it("keeps consecutive punctuation and rejects a break before leading-space punctuation", () => {
        expect(texts(fixture([["said", 0, 1], [" , okay", 2, 3]]).srt({ maxLineWidth: 4, maxLines: 1 }))).toEqual(["said ,", "okay"]);
        expect(texts(words(["said", ".", "”"]).srt({ maxLineWidth: 1, maxLines: 1 }))).toEqual(["said.”"]);
    });

    it("retains punctuation at the start of the document or after an explicit newline", () => {
        expect(texts(words(["word\n", "."]).srt())).toEqual(["word", "."]);
        expect(texts(words([".", " word"]).srt())).toEqual([".", "word"]);
        expect(texts(words(["word", ".\n", "next"]).srt())).toEqual(["word.", "next"]);
    });

    it("does not split before punctuation even across a pause", () => {
        expect(texts(fixture([["word", 0, 1], [".", 4, 5]]).srt({ pauseSeconds: 0.5, maxDurationSeconds: 1 }))).toEqual(["word."]);
    });

    it("keeps you're indivisible under width, duration and pause limits", () => {
        const f = fixture([[" you", 0, 4], ["'re", 4, 8], [" doing", 8, 9], [".", 9, 12]]);
        expect(texts(f.srt({ maxLineWidth: 4, maxLines: 1, maxDurationSeconds: 1, pauseSeconds: 0.5 }, 12, "en"))).toEqual(["you're", "doing."]);
        const gap = fixture([["you", 0, 1], ["'re", 4, 5]]);
        expect(times(gap.srt({ pauseSeconds: 0.5, maxDurationSeconds: 1 }, 5, "en"))).toEqual([[0, 5]]);
    });

    it("never breaks a dictionary word in character-level Chinese transcription", () => {
        const text = "青柳穿过繁华的上海街道。", f = words(Array.from(text));
        const boundaries = new Set([...new Intl.Segmenter("zh", { granularity: "word" }).segment(text)].map(segment => segment.index));
        boundaries.add(text.length);
        const lines = readSrt(f.srt({ maxLineWidth: 4, maxLines: 1 }, undefined, "zh").text).flatMap(cue => cue.lines);
        expect(lines.join("")).toBe(text);
        let offset = 0;
        for (const line of lines) {
            offset += line.length;
            expect(boundaries.has(offset)).toBe(true);
        }
    });

    it.each(["", "invalid_locale", "zz-ZZ"])("uses the runtime default when Run language %j is invalid or unsupported", language => {
        const f = words([" you", "'re", " doing", "."]), options = { maxLineWidth: 4, maxLines: 1 };
        expect(f.srt(options, undefined, language)).toEqual(f.srt(options));
    });

    it.each(["word", "transcript"])("removes legacy %s token settings without resetting preferences", tokenBasis => {
        const directory = mkdtempSync(join(tmpdir(), "vestige-export-legacy-")), path = join(directory, "settings.json");
        try {
            const srt = { ...defaultSettings.export.srt, maxDurationSeconds: 7, maxLineWidth: 55 };
            const legacy = { ...structuredClone(defaultSettings), language: "en", export: { format: "srt", srt: { ...srt, tokenBasis, maxTokens: 17 } } };
            writeFileSync(path, JSON.stringify(legacy));
            const loaded = readSettings(path);
            expect(loaded.settings.language).toBe("en");
            expect(loaded.settings.export).toEqual({ format: "srt", srt });
            expect(loaded.savedText).not.toBeNull();
        }
        finally {
            rmSync(path, { force: true }); rmdirSync(directory);
        }
    });
});

describe("SRT time normalization", () => {
    it("clips overlapping intervals at the next distinct start", () => {
        expect(times(fixture([["A", 0, 3], ["B", 2, 5]], [[1, 1, "\n"]]).srt({}))).toEqual([[0, 2], [2, 5]]);
    });

    it("raises descending starts while preserving unavoidable equal-start overlap", () => {
        const f = fixture([["A", 4, 5], ["B", 2, 3], ["C", 6, 7]], [[1, 1, "\n"], [2, 2, "\n"]]);
        expect(times(f.srt({ minDurationSeconds: 0.8 }))).toEqual([[4, 5], [4, 4.8], [6, 7]]);
    });

    it("clips negative and excessive times to the media duration", () => {
        const f = fixture([["A", -2, -1], ["B", 1, 3], ["C", 9, 12]], [[1, 1, "\n"], [2, 2, "\n"]]);
        expect(times(f.srt({ minDurationSeconds: 0.8 }, 10))).toEqual([[0, 0.8], [1, 3], [9, 10]]);
    });

    it("uses points only when no positive interval exists", () => {
        expect(times(fixture([["point", 0, 0], ["interval", 2, 3]]).srt())).toEqual([[2, 3]]);
        expect(times(fixture([["A", 2, 2], ["B", 4, 4]]).srt())).toEqual([[2, 4]]);
    });

    it("extends short cues without crossing the next start or media end", () => {
        const f = fixture([["A", 0, 0.1], ["B", 0.4, 0.5]], [[1, 1, "\n"]]);
        expect(times(f.srt({ minDurationSeconds: 0.8 }, 0.7))).toEqual([[0, 0.4], [0.4, 0.7]]);
    });

    it("rounds to milliseconds and supports hours wider than two digits", () => {
        expect(fixture([["A", 359999.9996, 360001.0006]]).srt({}, 400000).text).toContain("100:00:00,000 --> 100:00:01,001");
    });
});

describe("transcript export projections", () => {
    it("exports a raw Run identically to proofreading without modifications", () => {
        const vestige = project(transcript(["  中😀\r\n", " a\r\t "])).vestiges[0];
        const rawIndex = createTextIndex(vestige.runs[0].transcript);
        const proofreadIndex = createTextIndex(vestige.runs[vestige.displayedRunIdx].transcript);
        const raw = projectText(rawIndex, []), proofread = projectText(proofreadIndex, vestige.modifications);
        expect(exportSrt(rawIndex, raw, vestige.media.duration, unlimited)).toEqual(exportSrt(proofreadIndex, proofread, vestige.media.duration, unlimited));
        expect(exportPlainText(rawIndex, raw)).toBe(vestige.runs[0].transcript.map(span => span.token.text).join(""));
        expect(exportPlainText(proofreadIndex, proofread)).toBe(exportPlainText(rawIndex, raw));
    });

    it("preserves the edited projection exactly in plain text", () => {
        const f = fixture([[" 中😀\r\n", 0, 1], [" a\r\t ", 1, 2]], [[2, 2, "\tX\n"]]);
        expect(exportPlainText(f.index, f.projection)).toBe(f.projection.text);
    });

    it("keeps valid SRT structure and monotonic times through random edits and options", () => {
        const optionsArbitrary: fc.Arbitrary<SrtOptions> = fc.record({
            maxLineWidth: fc.option(fc.integer({ min: 4, max: 50 }), { nil: null }),
            maxLines: fc.integer({ min: 1, max: 5 }),
            pauseSeconds: fc.option(fc.integer({ min: 1, max: 20 }).map(value => value / 10), { nil: null }),
            maxDurationSeconds: fc.option(fc.integer({ min: 1, max: 7 }), { nil: null }),
            minDurationSeconds: fc.integer({ min: 0, max: 15 }).map(value => value / 10),
            splitAtLineBreaks: fc.boolean(),
            splitAtSentenceEnds: fc.boolean()
        });
        const sentenceEditingArbitrary = fc.tuple(editingArbitrary, fc.integer({ min: 2, max: 6 })).map(([sample, groupSize]) => ({
            ...sample,
            spans: sample.spans.map((span, i) => ({ ...span, range: { start: Math.floor(i / groupSize) * 3, end: (Math.floor(i / groupSize) + 1) * 3 } }))
        }));
        checkProperty("export-edited-srt", fc.property(fc.oneof(editingArbitrary, sentenceEditingArbitrary), optionsArbitrary, fc.integer({ min: 0, max: 15 }), ({ spans, edits }, options, duration) => {
            const index = createTextIndex(spans);
            let projection = projectText(index, []);
            for (const edit of edits) {
                const { from, to } = editRange(index, projection, edit);
                projection = editText(index, projection, from, to, edit.text);
                const result = exportSrt(index, projection, duration, options);
                const cues = readSrt(result.text);
                for (const [i, cue] of cues.entries()) {
                    expect(cue.start).toBeGreaterThanOrEqual(0);
                    expect(cue.end).toBeGreaterThanOrEqual(cue.start);
                    expect(cue.end).toBeLessThanOrEqual(duration);
                    if (!i) continue;
                    const previous = cues[i - 1];
                    expect(cue.start).toBeGreaterThanOrEqual(previous.start);
                    if (cue.start > previous.start) expect(previous.end).toBeLessThanOrEqual(cue.start);
                }
                expect(exportPlainText(index, projection)).toBe(projection.text);
            }
        }));
    });
});

describe("export character timing", () => {
    const timing = (f: ExportFixture, duration = Math.max(0, ...f.spans.map(span => span.range.end))): CharacterTiming => timeText(f.index, f.projection, duration);

    it("interpolates spoken codepoint widths, gives whitespace a point and duplicates surrogate timing", () => {
        const timed = timing(fixture([["A中😀 ", 2, 8]]));
        expect([...timed.start]).toEqual([2, 3.2, 5.6, 5.6, 8]);
        expect([...timed.end]).toEqual([3.2, 5.6, 8, 8, 8]);
        expect(new Set(timed.group).size).toBe(1);
    });

    it("groups only consecutive tokens with exactly equal positive raw ranges", () => {
        const f = fixture([["A", 2, 14], ["中", 2, 14], [" BBB", 2, 14], ["Z", 14, 15], ["X", 2, 14]]);
        const before = structuredClone(f.spans), timed = timing(f);
        expect(timed.end[0]).toBe(4);
        expect(timed.start[1]).toBe(timed.end[0]);
        expect(timed.end[1]).toBe(8);
        expect(timed.end[5]).toBe(14);
        expect(timed.group[0]).toBe(timed.group[5]);
        expect(timed.group[7]).not.toBe(timed.group[0]);
        expect(f.spans).toEqual(before);
    });

    it("retains deleted characters' time and allocates brwn → brown replacement by width", () => {
        const f = fixture([["brwn", 1, 5]], [[2, 4, "own"]]), timed = timing(f);
        expect(timed.text).toBe("brown");
        expect([...timed.start].slice(0, 2)).toEqual([1, 2]);
        expect(timed.start[2]).toBe(3);
        expect(timed.end[2]).toBeCloseTo(3 + 2 / 3);
        expect(timed.end[3]).toBeCloseTo(3 + 4 / 3);
        expect(timed.end[4]).toBe(5);
        expect(timed.group[2]).not.toBe(timed.group[1]);
        expect(timed.group[2]).toBe(timed.group[4]);
        expect(timed.unanchored).toBe(0);
        const deleted = timing(fixture([["brwn", 1, 5]], [[2, 3, ""]]));
        expect([...deleted.start]).toEqual([1, 2, 4]);
    });

    it("uses only positive deleted intervals, falling back to points when necessary", () => {
        const interval = timing(fixture([["A", 0, 0], ["B", 2, 4]], [[0, 2, "中x"]]));
        expect(interval.start[0]).toBe(2);
        expect(interval.end[0]).toBeCloseTo(2 + 4 / 3);
        expect(interval.end[1]).toBe(4);
        const points = timing(fixture([["A", 2, 2], ["B", 4, 4]], [[0, 2, "XY"]]));
        expect([...points.start]).toEqual([2, 3]);
        expect([...points.end]).toEqual([3, 4]);
    });

    it("divides a gap insertion by width and gives it its own timing group", () => {
        const timed = timing(fixture([["B", 3, 4]], [[0, 0, "中x"]]));
        expect([...timed.start]).toEqual([0, 2, 3]);
        expect([...timed.end]).toEqual([2, 3, 4]);
        expect(timed.group[0]).toBe(timed.group[1]);
        expect(timed.group[1]).not.toBe(timed.group[2]);
        expect(timed.unanchored).toBe(0);
    });

    it("attaches ordinary insertions to the preceding character end, even inside a token", () => {
        const timed = timing(fixture([["quik", 1, 3]], [[3, 3, "c"]]));
        expect(timed.start[3]).toBe(2.5);
        expect(timed.end[3]).toBe(2.5);
        expect(timed.group[3]).toBe(timed.group[2]);
        expect(timed.unanchored).toBe(1);
    });

    it("attaches at the next timed character start at the beginning or after a newline", () => {
        const beginning = timing(fixture([["AB", 0, 2]], [[0, 0, "X"]]));
        expect(beginning.start[0]).toBe(0);
        expect(beginning.end[0]).toBe(0);
        expect(beginning.group[0]).toBe(beginning.group[1]);
        const after = timing(fixture([["A", 0, 1], ["\r\n", 1, 1], ["B", 1, 2]], [[3, 3, "X"]]));
        expect(after.start[3]).toBe(1);
        expect(after.end[3]).toBe(1);
        expect(after.group[3]).toBe(after.group[4]);
    });

    it("uses zero with no timed characters and ignores newline-only insertions in the count", () => {
        const timed = timing(fixture([], [[0, 0, "\nA\r\n"]]));
        expect(timed.start[1]).toBe(0);
        expect(timed.end[1]).toBe(0);
        expect(timed.unanchored).toBe(1);
        expect(timing(fixture([], [[0, 0, "\r\n"]])).unanchored).toBe(0);
    });

    it("gives newlines no timing or interpolation width", () => {
        const timed = timing(fixture([["A\r\n😀B", 0, 6]]));
        expect([...timed.start]).toEqual([0, NaN, NaN, 1.5, 1.5, 4.5]);
        expect([...timed.end]).toEqual([1.5, NaN, NaN, 4.5, 4.5, 6]);
        expect([...timed.group].slice(1, 3)).toEqual([-1, -1]);
    });

    it("gives each zero-duration codepoint its own group", () => {
        const timed = timing(fixture([["A😀B", 2, 2], ["C", 2, 2]]));
        expect([...timed.start]).toEqual([2, 2, 2, 2, 2]);
        expect([...timed.group]).toEqual([0, 1, 1, 2, 3]);
    });

    it("projects pauses in UTF-16 and continues to count deleted speech", () => {
        const timed = timing(fixture([["😀", 0, 1], ["X", 1, 2], ["B", 3, 4]], [[1, 2, ""]]), 5);
        expect(timed.text).toBe("😀B");
        expect(timed.pauses).toEqual([{ offset: 2, length: 1 }, { offset: 3, length: 1 }]);
    });

    it("does not clip raw timing before grouping and interpolation", () => {
        const timed = timing(fixture([["A", -2, 2], ["B", -2, 2]]), 1);
        expect([...timed.start]).toEqual([-2, 0]);
        expect([...timed.end]).toEqual([0, 2]);
        expect(timed.group[0]).toBe(timed.group[1]);
        expect(timing(fixture([["", 1, 9], ["A", 1, 9], ["", 1, 9], ["B", 1, 9]])).end[1]).toBe(9);
    });
});

// Deliberately bypass Run/projection timing to test the cue layer's own decisions.
function manualTiming(text: string, ranges?: [number, number][], pauses: CharacterTiming["pauses"] = []): CharacterTiming {
    return {
        text, start: Float64Array.from(text, (_, i) => /[\r\n]/u.test(text[i]) ? NaN : ranges?.[i]?.[0] ?? i),
        end: Float64Array.from(text, (_, i) => /[\r\n]/u.test(text[i]) ? NaN : ranges?.[i]?.[1] ?? i + 1),
        group: Int32Array.from(text, (_, i) => /[\r\n]/u.test(text[i]) ? -1 : i), pauses, unanchored: 0
    };
}
function splitManual(timed: CharacterTiming, options: Partial<SrtOptions> = {}): string[] {
    const layout = textLayout(timed.text, "en");
    return cueRanges(timed, layout, { ...unlimited, ...options }).map(cue => timed.text.slice(layout.offsets[cue.from], layout.offsets[cue.to]).trim());
}

describe("export cue layer without a Run", () => {
    it("takes the union of pause, sentence, newline and capacity boundaries", () => {
        const timed = manualTiming("A B C. D\nE F G", undefined, [{ offset: 4, length: 1 }]);
        expect(splitManual(timed, { maxLineWidth: 3, maxLines: 1, pauseSeconds: 1 })).toEqual(["A B", "C.", "D", "E F", "G"]);
    });

    it("uses inclusive pauses only at valid word candidates", () => {
        expect(splitManual(manualTiming("alpha beta", undefined, [{ offset: 3, length: 1 }, { offset: 6, length: 0.5 }]), { pauseSeconds: 0.5 })).toEqual(["alpha", "beta"]);
        expect(splitManual(manualTiming("alpha beta", undefined, [{ offset: 6, length: 0.49 }]), { pauseSeconds: 0.5 })).toEqual(["alpha beta"]);
    });

    it("keeps line breaks inside a cue when splitting is disabled", () => {
        expect(splitManual(manualTiming("A\r\nB\nC"), { splitAtLineBreaks: false, maxLines: 3 })).toEqual(["A\r\nB\nC"]);
        expect(splitManual(manualTiming("A\r\nB\nC"), { splitAtLineBreaks: false, maxLines: 2 })).toEqual(["A\r\nB", "C"]);
    });

    it("ranks sentence endings before clauses before ordinary candidates", () => {
        expect(splitManual(manualTiming("a b. c, d e"), { maxLineWidth: 10, maxLines: 1, splitAtSentenceEnds: false })).toEqual(["a b.", "c, d e"]);
        expect(splitManual(manualTiming("a b, c d e"), { maxLineWidth: 8, maxLines: 1, splitAtSentenceEnds: false })).toEqual(["a b,", "c d e"]);
        expect(splitManual(manualTiming("a b c d e"), { maxLineWidth: 7, maxLines: 1 })).toEqual(["a b c d", "e"]);
    });

    it("takes the last qualifying boundary within a punctuation tier", () => {
        expect(splitManual(manualTiming("a b, c, d e f g"), { maxLineWidth: 13, maxLines: 1 })).toEqual(["a b, c,", "d e f g"]);
    });

    it("demotes punctuation below one-third width fill", () => {
        expect(splitManual(manualTiming("a. b c d e f g"), { maxLineWidth: 12, maxLines: 1, splitAtSentenceEnds: false })).toEqual(["a. b c d e f", "g"]);
        expect(splitManual(manualTiming("a. b, c d e f g"), { maxLineWidth: 12, maxLines: 1, splitAtSentenceEnds: false })).toEqual(["a. b,", "c d e f g"]);
    });

    it("qualifies punctuation at exactly one-third fill and takes the maximum of constraints", () => {
        const timed = manualTiming("a. b c d e f", [[0, 1], [1, 3], [3, 3], [3, 4], [4, 4], [4, 5], [5, 5], [5, 6], [6, 6], [6, 7], [7, 10]]);
        expect(splitManual(timed, { maxDurationSeconds: 9, maxLineWidth: 200, maxLines: 1, splitAtSentenceEnds: false })[0]).toBe("a.");
    });

    it("only splits an overlong envelope when an added fragment lengthens it", () => {
        const timed = manualTiming("A B C D", [[0, 20], [2, 2], [2, 3], [3, 3], [4, 5], [5, 5], [20, 21]]);
        expect(splitManual(timed, { maxDurationSeconds: 7 })).toEqual(["A B C", "D"]);
    });

    it("ignores whitespace and isolated points when a cue has positive intervals", () => {
        const timed = manualTiming(" A B ", [[-100, -100], [2, 3], [0, 0], [3, 4], [100, 100]]);
        expect(splitManual(timed, { maxDurationSeconds: 2 })).toEqual(["A B"]);
    });

    it("lets a single over-capacity candidate stand alone and retries the remaining tail", () => {
        expect(splitManual(manualTiming("A, B CCCCC D"), { maxLineWidth: 4, maxLines: 1 })).toEqual(["A,", "B", "CCCCC", "D"]);
        expect(splitManual(manualTiming("oversized"), { maxDurationSeconds: 1, maxLineWidth: 4, maxLines: 1 })).toEqual(["oversized"]);
    });

    it.each([",", "。", ")", "”"])("never breaks before %s even when preceded by spaces", punctuation => {
        const timed = manualTiming("A B " + punctuation + " C", undefined, [{ offset: 4, length: 5 }]);
        expect(splitManual(timed, { pauseSeconds: 1, maxLineWidth: 3, maxLines: 1 }).every(text => !text.startsWith(punctuation))).toBe(true);
    });
});

describe("SRT character timing and estimation", () => {
    it("splits a single KateDarling-sized token into words with increasing width-based times", () => {
        const text = "There was a day, about ten years ago, when I asked a friend to hold a baby dinosaur robot upside down. ".repeat(3).trim();
        const f = fixture([[text, 417.4, 434.6]]), result = f.srt(defaultSettings.export.srt, 450, "en"), cues = readSrt(result.text);
        expect(cues.length).toBeGreaterThan(3);
        expect(cues.every(cue => cue.lines.join(" ").length < 100)).toBe(true);
        expect(cues[0].start).toBe(417.4);
        expect(cues.at(-1)!.end).toBe(434.6);
        // Silent characters no longer contribute to the interpolation weights.
        const width = (text: string): number => Array.from(text).reduce((sum, character) => sum
            + (/[\p{White_Space}\p{P}]/u.test(character) ? 0 : characterWidth(character.codePointAt(0)!)), 0);
        const total = width(text);
        let search = 0;
        for (const [i, cue] of cues.entries()) {
            const content = cue.lines.join(" "), offset = text.indexOf(content, search);
            expect(offset).toBeGreaterThanOrEqual(search);
            expect(cue.start).toBeCloseTo(417.4 + 17.2 * width(text.slice(0, offset)) / total, 3);
            expect(cue.end).toBeCloseTo(417.4 + 17.2 * width(text.slice(0, offset + content.length)) / total, 3);
            if (i) expect(cue.start).toBeGreaterThan(cues[i - 1].start);
            search = offset + content.length;
        }
        expect(result.estimated).toBe(true);
    });

    it("does not estimate cues whose atom boundaries are all original token boundaries", () => {
        const result = fixture([["甲。", 0, 1], ["乙。", 1, 2], ["丙。", 2, 3]]).srt();
        expect(times(result)).toEqual([[0, 1], [1, 2], [2, 3]]);
        expect(result.estimated).toBe(false);
    });

    it("estimates a cut inside a token or inside a group of equal-time tokens", () => {
        const single = fixture([["A. B.", 0, 5]]).srt();
        expect(times(single)).toEqual([[0, 2.5], [2.5, 5]]);
        expect(single.estimated).toBe(true);
        const grouped = fixture([["甲。", 0, 4], ["乙。", 0, 4]]).srt();
        expect(times(grouped)).toEqual([[0, 2], [2, 4]]);
        expect(grouped.estimated).toBe(true);
    });

    it("does not estimate solely because trimming removes point-timed whitespace", () => {
        const result = fixture([[" A ", 1, 4]]).srt();
        expect(times(result)).toEqual([[1, 4]]);
        expect(result.estimated).toBe(false);
    });

    it("does not estimate an intact group, deleted group, empty export or point groups", () => {
        expect(fixture([["A", 0, 8], ["B", 0, 8]]).srt().estimated).toBe(false);
        expect(fixture([["A", 0, 8], ["B", 0, 8]], [[0, 2, ""]]).srt()).toEqual({ text: "", unanchored: 0, estimated: false });
        const points = fixture([["甲。", 2, 2], ["乙。", 2, 2]]).srt();
        expect(times(points)).toEqual([[2, 2], [2, 2]]);
        expect(points.estimated).toBe(false);
    });

    it("allocates newline-separated original characters without timing the newline itself", () => {
        const result = fixture([["A\n", 0, 9], ["BB", 0, 9]]).srt();
        expect(times(result)).toEqual([[0, 3], [3, 9]]);
        expect(result.estimated).toBe(true); // Point-timed newlines no longer hide a cut inside the same group.
    });

    it("keeps exact adjacent source-group endpoints before clipping", () => {
        const result = fixture([["甲。", -2, 2], ["乙。", -2, 2], ["丙。", 2, 6], ["丁。", 2, 6]]).srt({}, 5);
        expect(times(result)).toEqual([[0, 0], [0, 2], [2, 4], [4, 5]]);
        expect(result.estimated).toBe(true);
    });

    it("anchors a cross-sentence Japanese replacement at deleted character times", () => {
        const prefix = "前文".repeat(104), items: TimedText[] = [[prefix, 0, 17.593], ["。", 0, 17.593], ["夜間に続く".repeat(40), 17.593, 31.353]];
        const f = fixture(items, [[prefix.length, prefix.length + 3, "\nやけ"]]);
        // The deleted period and inserted newline now take no time; positive deleted intervals start at 17.593.
        const expected = 17.593;
        for (const minDurationSeconds of [0, 0.8]) {
            const result = f.srt({ maxLineWidth: 42, maxLines: 1, minDurationSeconds }, 31.353, "ja");
            const cues = readSrt(result.text), replacement = cues.find(cue => cue.lines.join("").includes("やけ"))!;
            expect(replacement.start).toBeCloseTo(expected, 3);
            expect(result.estimated).toBe(true);
            for (let i = 1; i < cues.length; i++) expect(cues[i - 1].end).toBeLessThanOrEqual(cues[i].start);
        }
    });
});

function medianTime(action: () => void): number {
    action();
    const samples = Array.from({ length: 5 }, () => {
        const start = performance.now();
        action();
        return performance.now() - start;
    }).sort((a, b) => a - b);
    return samples[2];
}

describe("export text atoms", () => {
    it("attaches punctuation to the preceding word and keeps CRLF as one newline atom", () => {
        const text = "hello, world。\r\nnext.)  last", layout = textLayout(text, "en");
        const atoms = layout.offsets.slice(0, -1).map((from, i) => text.slice(from, layout.offsets[i + 1]));
        expect(atoms).toEqual(["hello,", " ", "world。", "\r\n", "next.)", "  ", "last"]);
        expect(layout.lineBreaks).toEqual([false, false, false, true, false, false, false]);
    });

    it.each([
        ["word", "ordinary"], ["word,", "clause"], ["word.  ", "sentence"],
        ["好。”  ", "sentence"], ["Yes.)\t", "sentence"], ["a，】 ", "clause"], ["😀 ", "ordinary"]
    ])("classifies the end of %j without rescanning its prefix", (text, expected) => {
        expect(textLayout(text).boundaries.at(-1)).toBe(expected);
    });

    it("scales far below quadratic growth from about 4k to 40k Chinese characters", () => {
        const small = "甲乙丙丁戊己庚辛壬癸。".repeat(400), large = small.repeat(10);
        textLayout(large, "zh");
        const smallTime = medianTime(() => textLayout(small, "zh"));
        const largeTime = medianTime(() => textLayout(large, "zh"));
        expect(largeTime / smallTime).toBeLessThan(40);
    });
});

describe("export silent character timing", () => {
    it("gives whitespace and punctuation points while spoken characters receive the whole interval", () => {
        const f = fixture([[" A,中! \tB.", 2, 10]]), timed = timeText(f.index, f.projection, 10);
        expect([...timed.start]).toEqual([2, 2, 4, 4, 8, 8, 8, 8, 10]);
        expect([...timed.end]).toEqual([2, 4, 4, 8, 8, 8, 8, 10, 10]);
    });

    it.each([".", "，! ", " \t"])("retains the original interval for an entirely silent group %j", text => {
        const f = fixture([[text, 56.73, 59.97]]), timed = timeText(f.index, f.projection, 60);
        expect([...timed.start]).toEqual(Array(text.length).fill(56.73));
        expect([...timed.end]).toEqual(Array(text.length).fill(59.97));
        if (text === ".") expect(times(f.srt())).toEqual([[56.73, 59.97]]);
    });

    it("does not assign replacement punctuation a share of the deleted speech", () => {
        const f = fixture([["AB", 0, 4]], [[0, 2, "x, y!"]]), timed = timeText(f.index, f.projection, 4);
        expect([...timed.start]).toEqual([0, 2, 2, 2, 4]);
        expect([...timed.end]).toEqual([2, 2, 2, 4, 4]);
    });

    it("does not assign gap insertion whitespace and punctuation a share of silence", () => {
        const f = fixture([["B", 6, 7]], [[0, 0, " x,中!"]]), timed = timeText(f.index, f.projection, 7);
        expect([...timed.start].slice(0, 5)).toEqual([0, 0, 2, 2, 6]);
        expect([...timed.end].slice(0, 5)).toEqual([0, 2, 2, 6, 6]);
    });

    it("uses the preceding end for 7 after a final 给 and newline when no timed character follows", () => {
        const f = fixture([["给\n", 3, 4]], [[2, 2, "7"]]), timed = timeText(f.index, f.projection, 4);
        expect(timed.text).toBe("给\n7");
        expect(timed.start[2]).toBe(4);
        expect(timed.end[2]).toBe(4);
        expect(timed.group[2]).toBe(timed.group[0]);
        expect(times(f.srt())).toEqual([[3, 4], [4, 4]]);
        const empty = fixture([], [[0, 0, "\n7"]]), withoutAnchor = timeText(empty.index, empty.projection, 0);
        expect(withoutAnchor.start[1]).toBe(0);
        expect(withoutAnchor.group[1]).toBe(-1);
    });
});

describe("SRT atom boundary estimation and scalability", () => {
    it("does not estimate whisper-style tokens with leading spaces when cues end at token boundaries", () => {
        const result = fixture([[" hello", 0, 1], [" world", 1, 2], [" again", 2, 3]])
            .srt({ maxLineWidth: 5, maxLines: 1 });
        expect(texts(result)).toEqual(["hello", "world", "again"]);
        expect(times(result)).toEqual([[0, 1], [1, 2], [2, 3]]);
        expect(result.estimated).toBe(false);
    });

    it("estimates Qwen-style cues inside one group even when their boundary follows a space", () => {
        const f = fixture([["hello", 0, 10], [" world", 0, 10]]), options = { ...unlimited, maxLineWidth: 5, maxLines: 1 };
        const timed = timeText(f.index, f.projection, 10), layout = textLayout(timed.text, "en"), cues = cueRanges(timed, layout, options);
        expect(layout.offsets[cues[0].to]).toBe(6);
        expect(timed.start[5]).toBe(5);
        expect(timed.end[5]).toBe(5);
        const result = f.srt(options);
        expect(times(result)).toEqual([[0, 5], [5, 10]]);
        expect(result.estimated).toBe(true);
    });

    it("estimates a cut inside a whitespace-and-opening-quote token that retains its full interval", () => {
        // Author confirmed: an entirely silent token keeps positive intervals, so this real Whisper boundary is estimated.
        const f = fixture([["interaction is not,", 589, 590.45], [" \"", 590.45, 590.5], ["Do", 590.5, 591]]);
        const result = f.srt({ maxLineWidth: 19, maxLines: 1, splitAtSentenceEnds: false });
        expect(texts(result)).toEqual(["interaction is not,", "\"Do"]);
        expect(result.estimated).toBe(true);
    });

    it("ignores a two-second pause inside the indivisible dictionary word 一二三", () => {
        const f = fixture([["一", 0, 1], ["二", 1, 2], ["三", 4, 5]]);
        expect(textLayout(f.projection.text, "zh").offsets).toEqual([0, 3]);
        const result = f.srt({ pauseSeconds: 0.5 }, 5, "zh");
        expect(texts(result)).toEqual(["一二三"]);
        expect(times(result)).toEqual([[0, 5]]);
    });

    it("scales far below quadratic growth from 1k to 10k atoms with all limits disabled", () => {
        const options = { ...unlimited, splitAtLineBreaks: false, splitAtSentenceEnds: false };
        const prepare = (count: number): (() => void) => {
            const timed = manualTiming("word ".repeat(count / 2)), layout = textLayout(timed.text, "en");
            expect(layout.offsets).toHaveLength(count + 1);
            expect(cueRanges(timed, layout, options)).toEqual([{ from: 0, to: count }]);
            return () => {
                cueRanges(timed, layout, options);
            };
        };
        const small = prepare(1000), large = prepare(10000);
        large();
        const smallTime = medianTime(small), largeTime = medianTime(large);
        expect(largeTime / smallTime).toBeLessThan(40);
    });
});

describe("export opening punctuation atoms", () => {
    const atomsOf = (text: string, language = "en"): string[] => {
        const layout = textLayout(text, language);
        return layout.offsets.slice(0, -1).map((from, i) => text.slice(from, layout.offsets[i + 1]));
    };

    it.each([1, 2])("keeps English opening quotes with their word across narrow lines and cues (maxLines=%i)", maxLines => {
        const text = "he said “Hello” to me";
        expect(atomsOf(text)).toEqual(["he", " ", "said", " ", "“Hello”", " ", "to", " ", "me"]);
        const cues = readSrt(fixture([[text, 0, 10]]).srt({ maxLineWidth: 4, maxLines }).text);
        expect(cues.flatMap(cue => cue.lines).every(line => !line.endsWith("“"))).toBe(true);
        expect(cues.every(cue => !cue.lines.at(-1)!.endsWith("“"))).toBe(true);
        expect(cues.flatMap(cue => cue.lines).filter(line => line.includes("Hello"))).toEqual(["“Hello”"]);
    });

    it.each(["\"", "'"])("treats the ASCII quote %j after whitespace as an opening mark", quote => {
        const text = `he said ${quote}Hello${quote}`;
        expect(atomsOf(text)).toContain(quote + "Hello");
        const cues = readSrt(fixture([[text, 0, 10]]).srt({ maxLineWidth: 4, maxLines: 1 }).text);
        expect(cues.some(cue => cue.lines.some(line => line.startsWith(quote + "Hello")))).toBe(true);
    });

    it.each(["you're", "don't"])("keeps the apostrophe in %j unchanged", word => {
        expect(atomsOf(word)).toEqual([word]);
        expect(texts(words([word]).srt({ maxLineWidth: 4, maxLines: 1 }))).toEqual([word]);
    });

    it("keeps a whisper 're token inside the same dictionary word as its preceding token", () => {
        const f = words(["you", "'re", " doing"]);
        expect(atomsOf(f.projection.text)).toEqual(["you're", " ", "doing"]);
        expect(texts(f.srt({ maxLineWidth: 4, maxLines: 1 }))).toEqual(["you're", "doing"]);
        expect(atomsOf("'re")).toEqual(["'re"]);
    });

    it.each([
        { text: "「こんにちは」", language: "ja" }, { text: "（注释）", language: "zh" },
        { text: "《书名》", language: "zh" }, { text: "『こんにちは』", language: "ja" },
        { text: "[Hello]", language: "en" }, { text: "«Hello»", language: "en" }
    ])("keeps the opening mark of $text off line and cue endings", ({ text, language }) => {
        expect(atomsOf(text, language)).toEqual([text]);
        const input = "before " + text + " after";
        for (const maxLines of [1, 2]) {
            const cues = readSrt(fixture([[input, 0, 10]]).srt({ maxLineWidth: 4, maxLines }, 10, language).text);
            expect(cues.flatMap(cue => cue.lines).every(line => !/[\p{Ps}\p{Pi}]$/u.test(line))).toBe(true);
            expect(cues.every(cue => !/[\p{Ps}\p{Pi}]$/u.test(cue.lines.at(-1)!))).toBe(true);
            expect(cues.flatMap(cue => cue.lines)).toContain(text);
        }
    });

    it.each([" ", "\t", "\u3000"])("keeps opening parentheses with the following word across %j whitespace", whitespace => {
        const text = "(" + whitespace + "Hello)";
        expect(atomsOf(text)).toEqual([text]);
        expect(texts(fixture([[text, 0, 5]]).srt({ maxLineWidth: 4, maxLines: 1 }))).toEqual([text]);
    });

    it.each(["\"Hello", "(\"Hello", "“'Hello", "\"'Hello"])("recognizes opening ASCII quote context in %j", text => {
        expect(atomsOf(text)).toEqual([text]);
    });

    it("does not treat ASCII quotes following letters or closing quotes as opening marks", () => {
        const text = "Hello\" next", layout = textLayout(text, "en");
        expect(layout.offsets).toContain(6);
        const nested = "Hello\"' next";
        expect(textLayout(nested, "en").offsets).toContain(7);
    });

    it.each(["\n", "\r", "\r\n"])("retains both sides of an explicit %j newline after an opening mark", newline => {
        for (const opener of ["“", "(", "\""]) {
            const text = "said " + opener + " \t" + newline + " Hello", layout = textLayout(text, "en");
            const start = text.indexOf(newline);
            expect(layout.offsets).toContain(start);
            expect(layout.offsets).toContain(start + newline.length);
            expect(layout.lineBreaks.filter(Boolean)).toHaveLength(1);
            expect(texts(fixture([[text, 0, 10]]).srt())).toEqual(["said " + opener, "Hello"]);
            expect(texts(fixture([[text, 0, 10]]).srt({ splitAtLineBreaks: false }))).toEqual(["said " + opener + "\nHello"]);
        }
    });
});