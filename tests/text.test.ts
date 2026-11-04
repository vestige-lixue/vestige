import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
    createTextIndex, projectText, textPieces, projectionOffset, projectedOffset, editText, textPosition, textOffset, codepointToUtf16, utf16ToCodepoint, normalizeModifications,
    provenanceChange, commitText, alignText, restoreTextDeletion
} from "../shared/transcript/text";
import { modification, referenceText, sourcePosition, sourceOffset, transcript } from "./support/fixtures";
import { editingArbitrary, editRange, patchesArbitrary, transcriptArbitrary, normalizationArbitrary, textArbitrary } from "./support/generators";
import { checkProperty } from "./support/properties";

describe("text projection and editing", () => {
    it("projects original-coordinate changes like an independent string reference", () => {
        checkProperty("projection-equivalence", fc.property(patchesArbitrary, ({ spans, modifications }) => {
            const original = structuredClone({ spans, modifications });
            const index = createTextIndex(spans);
            const projection = projectText(index, modifications);
            expect(projection.text).toBe(referenceText(spans, modifications));
            expect(textPieces(index, projection).map(piece => piece.text).join("")).toBe(projection.text);
            let offset = 0;
            for (const piece of textPieces(index, projection)) {
                expect(piece.from).toBe(offset);
                offset += [...piece.text].length;
                expect(piece.to).toBe(offset);
                expect(piece.sourceFrom).toBeGreaterThanOrEqual(0);
                expect(piece.sourceTo).toBeGreaterThanOrEqual(piece.sourceFrom);
                expect(piece.sourceTo).toBeLessThanOrEqual(index.characters.length);
            }
            expect(projection.length).toBe(offset);
            expect({ spans, modifications }).toEqual(original);
        }));
    });

    it("keeps each boundary-biased edit equivalent to a codepoint-array splice", () => {
        checkProperty("editing-equivalence", fc.property(editingArbitrary, ({ spans, edits }) => {
            const index = createTextIndex(spans);
            const original = structuredClone(index);
            let projection = projectText(index, []);
            const expected = [...projection.text];
            const provenance = expected.map((text, source) => ({ text, source: source as number | null }));
            for (const edit of edits) {
                const range = editRange(index, projection, edit);
                const before = structuredClone(projection);
                const previous = [...provenance];
                const next = editText(index, projection, range.from, range.to, edit.text);
                provenance.splice(range.from, range.to - range.from, ...[...edit.text].map(text => ({ text, source: null })));
                expected.splice(range.from, range.to - range.from, ...edit.text);
                expect(next.text).toBe(expected.join(""));
                expect(next.length).toBe(expected.length);
                const pieces = textPieces(index, next);
                const actualSources = pieces.flatMap(piece => [...piece.text].map((text, offset) => ({
                    text, source: piece.source.kind === "segment" ? piece.sourceFrom + offset : null
                })));
                let previousSource = -1;
                for (const [position, actual] of actualSources.entries()) {
                    expect(actual.text).toBe(provenance[position].text);
                    if (provenance[position].source !== null) expect(actual.source).toBe(provenance[position].source);
                    if (actual.source !== null) {
                        expect(actual.source).toBeGreaterThan(previousSource);
                        expect(actual.text).toBe(index.characters[actual.source]);
                        previousSource = actual.source;
                    }
                }
                // Only characters written by this edit may acquire source identities.
                expect(actualSources.slice(0, range.from)).toEqual(previous.slice(0, range.from));
                expect(actualSources.slice(range.from + [...edit.text].length)).toEqual(previous.slice(range.to));
                provenance.splice(0, provenance.length, ...actualSources);
                // Editors resynchronize provenance only inside the reported range, so everything outside it must match.
                const change = provenanceChange(index, projection, next) ?? { from: actualSources.length, to: actualSources.length };
                expect(actualSources.slice(0, change.from)).toEqual(previous.slice(0, change.from));
                expect(actualSources.slice(change.to)).toEqual(previous.slice(previous.length - (actualSources.length - change.to)));
                expect(textPieces(index, projectText(index, next.modifications))).toEqual(pieces);
                for (let offset = 0, utf16 = 0; offset <= expected.length; offset++) {
                    expect(projectionOffset(next, offset, true)).toBe(utf16);
                    expect(projectionOffset(next, utf16, false)).toBe(offset);
                    utf16 += expected[offset]?.length ?? 0;
                }
                for (let source = 0; source <= index.characters.length; source++) {
                    const piece = pieces.find(piece => piece.sourceTo > source);
                    const expectedPosition = !piece ? next.text.length : piece.utf16From + (piece.source.kind === "segment"
                        ? [...piece.text].slice(0, source - piece.sourceFrom).join("").length : 0);
                    expect(projectedOffset(next, source)).toBe(expectedPosition);
                }
                expect(projection).toEqual(before);
                projection = next;
            }
            expect(index).toEqual(original);
        }));
    });

    it("round-trips canonical source coordinates and every valid UTF-16 boundary", () => {
        checkProperty("coordinate-roundtrip", fc.property(transcriptArbitrary, spans => {
            const index = createTextIndex(spans);
            const text = spans.map(span => span.token.text).join("");
            let utf16 = 0;
            for (let offset = 0; offset <= index.characters.length; offset++) {
                const position = textPosition(index, offset);
                expect(position).toEqual(sourcePosition(spans, offset));
                expect(textOffset(index, position)).toBe(offset);
                expect(codepointToUtf16(text, offset)).toBe(utf16);
                expect(utf16ToCodepoint(text, utf16)).toBe(offset);
                if (offset < index.characters.length) utf16 += index.characters[offset].length;
            }
        }));
    });

    it("uses the unique EOF position with empty and interleaved empty spans", () => {
        for (const texts of [[], [""], ["", "", ""], ["", "a", "", "b", ""]]) {
            const spans = transcript(texts);
            const index = createTextIndex(spans);
            const end = index.characters.length;
            expect(textPosition(index, end)).toEqual({ segmentIdx: spans.length, offset: 0 });
            expect(editText(index, projectText(index, []), end, end, "尾").text).toBe(texts.join("") + "尾");
        }
    });

    it("can retype at a deletion anchor after deleting the complete original", () => {
        const index = createTextIndex(transcript(["Out", "ro"]));
        const empty = editText(index, projectText(index, []), 0, 5, "");
        expect(empty.text).toBe("");
        const retyped = editText(index, empty, 0, 0, "新");
        expect(retyped.text).toBe("新");
        expect(editText(index, retyped, 0, 1, "Outro").text).toBe("Outro");
    });

    it("edits replacement interiors and deletes across existing modification boundaries", () => {
        const index = createTextIndex(transcript(["abc", "def"]));
        let value = projectText(index, []);
        value = editText(index, value, 1, 3, "XY");
        value = editText(index, value, 2, 2, "😀");
        expect(value.text).toBe("aX😀Ydef");
        value = editText(index, value, 4, 5, "");
        expect(value.text).toBe("aX😀Yef");
        expect(editText(index, value, 1, 5, "").text).toBe("af");
    });

    it("treats combining marks and ZWJ as codepoints while rejecting split surrogate positions", () => {
        const text = "Ae\u0301👩‍🔬𝄞\n";
        const index = createTextIndex(transcript([text]));
        expect(editText(index, projectText(index, []), 2, 3, "").text).toBe("Ae👩‍🔬𝄞\n");
        let position = 0;
        for (const character of text) {
            if (character.length === 2) expect(() => utf16ToCodepoint(text, position + 1)).toThrow(RangeError);
            position += character.length;
        }
    });

    it("rejects invalid source coordinates, reversed ranges and actual overlap", () => {
        const spans = transcript(["a", "", "b"]);
        const index = createTextIndex(spans);
        for (const position of [
            { segmentIdx: 0, offset: 1 }, { segmentIdx: 1, offset: 0 },
            { segmentIdx: 3, offset: 1 }, { segmentIdx: -1, offset: 0 },
            { segmentIdx: 0, offset: 0.5 }
        ]) expect(() => textOffset(index, position)).toThrow(RangeError);
        expect(() => projectText(index, modification(spans, 2, 1, ""))).toThrow(RangeError);
        expect(() => projectText(index, [...modification(spans, 0, 2, ""), ...modification(spans, 1, 2, "x")])).toThrow(RangeError);
        const projection = projectText(index, []);
        for (const [from, to] of [[-1, 0], [1, 0], [0, 3], [0, 0.5]]) {
            expect(() => editText(index, projection, from, to, "")).toThrow(RangeError);
        }
    });

    it("normalizes source-anchored operations without changing displayed text or provenance", () => {
        checkProperty("normalization", fc.property(normalizationArbitrary, ({ spans, modifications }) => {
            const before = structuredClone(modifications);
            const index = createTextIndex(spans);
            const normalized = normalizeModifications(index, modifications);
            expect(normalizeModifications(index, normalized)).toEqual(normalized);
            expect(referenceText(spans, normalized)).toBe(referenceText(spans, modifications));
            expect(projectText(index, normalized).text).toBe(referenceText(spans, modifications));
            const deletions = normalized.filter(item => item.type === "delete").map(item => ({
                from: sourceOffset(spans, item.range.start), to: sourceOffset(spans, item.range.end)
            }));
            for (let i = 0; i < deletions.length; i++) {
                expect(deletions[i].from).toBeLessThan(deletions[i].to);
                if (i) expect(deletions[i - 1].to).toBeLessThan(deletions[i].from);
            }
            let previous = -1;
            const anchors = new Set<number>();
            for (const item of normalized) {
                const position = sourceOffset(spans, item.type === "insert" ? item.pos : item.range.start);
                expect(position).toBeGreaterThanOrEqual(previous);
                previous = position;
                if (item.type === "insert") {
                    expect(item.text).not.toBe("");
                    expect(anchors.has(position)).toBe(false);
                    anchors.add(position);
                    expect(deletions.some(range => range.from <= position && position < range.to)).toBe(false);

                }
            }
            const deleted = new Set(before.filter(item => item.type === "delete").flatMap(item => Array.from({ length: sourceOffset(spans, item.range.end) - sourceOffset(spans, item.range.start) }, (_, i) => sourceOffset(spans, item.range.start) + i)));
            const originalSources = index.characters.flatMap((_, i) => deleted.has(i) ? [] : [i]);
            expect(textPieces(index, projectText(index, normalized)).filter(piece => piece.source.kind === "segment").flatMap(piece => Array.from({ length: piece.to - piece.from }, (_, i) => piece.sourceFrom + i))).toEqual(originalSources);
            expect(modifications).toEqual(before);
        }));
    });

    it.each([
        { original: "Outro", from: 3, to: 4, inserted: "ar", insertion: [4, "ar"] as const, deletion: [3, 4] as const, text: "Outaro" },
        { original: "Outro", from: 2, to: 4, inserted: "t", insertion: null, deletion: [3, 4] as const, text: "Outo" },
        { original: "Outro", from: 2, to: 4, inserted: "r", insertion: [4, "r"] as const, deletion: [2, 4] as const, text: "Ouro" },
        { original: "rx", from: 0, to: 2, inserted: "ar", insertion: [2, "ar"] as const, deletion: [0, 2] as const, text: "ar" },
        { original: "Outro", from: 0, to: 5, inserted: "Outro", insertion: null, deletion: null, text: "Outro" },
        { original: "𝄞中x", from: 0, to: 3, inserted: "a𝄞中", insertion: [3, "a𝄞中"] as const, deletion: [0, 3] as const, text: "a𝄞中" },
        { original: "rx", from: 0, to: 2, inserted: "xa", insertion: [2, "xa"] as const, deletion: [0, 2] as const, text: "xa" },
        { original: "𝄞中x", from: 0, to: 3, inserted: "中xa", insertion: [3, "中xa"] as const, deletion: [0, 3] as const, text: "中xa" }
    ])("restores only the matching input prefix for $original / $inserted", ({ original, from, to, inserted, insertion, deletion, text }) => {
        const spans = transcript([...original]);
        const index = createTextIndex(spans);
        const removed = editText(index, projectText(index, []), from, to, "");
        const value = editText(index, removed, from, from, inserted);
        const expected = [
            ...deletion ? modification(spans, deletion[0], deletion[1], "") : [],
            ...insertion ? modification(spans, insertion[0], insertion[0], insertion[1]) : []
        ].sort((left, right) => sourceOffset(spans, left.type === "insert" ? left.pos : left.range.start)
            - sourceOffset(spans, right.type === "insert" ? right.pos : right.range.start));
        expect(value.text).toBe(text);
        expect(value.modifications).toEqual(expected);
        expect(normalizeModifications(index, value.modifications)).toEqual(expected);
        expect(textPieces(index, value)).toEqual(textPieces(index, projectText(index, expected)));
    });

    it("does not restore earlier input when later deleting its neighbors", () => {
        const index = createTextIndex(transcript(["ab"]));
        let value = editText(index, projectText(index, []), 0, 2, "");
        value = editText(index, value, 0, 0, "xx");
        value = editText(index, value, 2, 2, "a");
        const next = editText(index, value, 0, 2, "");
        expect(textPieces(index, next).filter(piece => piece.text).map(piece => piece.source.kind)).toEqual(["modification"]);
        expect(provenanceChange(index, value, next)).toEqual({ from: 0, to: 1 });
    });

    it("preserves the original deletion when editing an adjacent insertion", () => {
        const spans = transcript(["ab"]);
        const index = createTextIndex(spans);
        let value = editText(index, projectText(index, []), 2, 2, "XX");
        value = editText(index, value, 1, 2, "");
        expect(value.text).toBe("aXX");
        value = editText(index, value, 2, 2, "Y");
        expect(value.text).toBe("aXYX");
        expect(value.modifications).toEqual([
            { type: "delete", range: { start: sourcePosition(spans, 1), end: sourcePosition(spans, 2) } },
            { type: "insert", pos: sourcePosition(spans, 2), text: "XYX" }
        ]);
    });

    it("merges neighboring deletions across inserted text according to D17", () => {
        const spans = transcript(["Outro"]);
        const index = createTextIndex(spans);
        let value = editText(index, projectText(index, []), 3, 4, "");
        value = editText(index, value, 3, 3, "a");
        value = editText(index, value, 2, 3, "");
        expect(value.text).toBe("Ouao");
        expect(value.modifications).toEqual([
            { type: "delete", range: { start: sourcePosition(spans, 2), end: sourcePosition(spans, 4) } },
            { type: "insert", pos: sourcePosition(spans, 4), text: "a" }
        ]);
        expect(textPieces(index, value).find(piece => piece.sourceFrom === 2 && piece.sourceTo === 4)).toMatchObject({ from: 2, to: 2, text: "" });
        expect(editText(index, value, 3, 3, "tr").text).toBe("Ouatro");
    });

    it("orders absorbed insertions by original anchor and preserves same-anchor order", () => {
        const spans = transcript(["abcd"]);
        const index = createTextIndex(spans);
        const changes = [
            ...modification(spans, 3, 3, "C"),
            ...modification(spans, 1, 2, ""),
            ...modification(spans, 2, 2, "B1"),
            ...modification(spans, 2, 3, ""),
            ...modification(spans, 1, 1, "A"),
            ...modification(spans, 2, 2, "B2")
        ];
        const value = projectText(index, changes);
        expect(value.text).toBe("aAB1B2Cd");
        expect(value.modifications).toEqual([
            { type: "delete", range: { start: sourcePosition(spans, 1), end: sourcePosition(spans, 3) } },
            { type: "insert", pos: sourcePosition(spans, 3), text: "AB1B2C" }
        ]);
        expect(normalizeModifications(index, [
            { type: "insert", pos: sourcePosition(spans, 0), text: "" },
            { type: "delete", range: { start: sourcePosition(spans, 0), end: sourcePosition(spans, 0) } }
        ])).toEqual([]);
    });

    it("anchors text typed at a deletion marker after the deletion", () => {
        const spans = transcript(["Outro"]);
        const index = createTextIndex(spans);
        const removed = editText(index, projectText(index, []), 1, 2, "");
        const value = editText(index, removed, 1, 1, "h");
        expect(value.text).toBe("Ohtro");
        expect(value.modifications).toEqual([
            ...modification(spans, 1, 2, ""),
            ...modification(spans, 2, 2, "h")
        ]);
        expect(textPieces(index, value).filter(piece => piece.source.kind === "modification").map(piece => ({
            from: piece.from, to: piece.to, text: piece.text
        }))).toEqual([{ from: 1, to: 1, text: "" }, { from: 1, to: 2, text: "h" }]);
    });

    it.each(["", "h"])("matches a deletion only when no added characters remain: %s", replacement => {
        const spans = transcript(["Outro"]);
        const index = createTextIndex(spans);
        const removed = editText(index, projectText(index, []), 1, 2, replacement);
        const restored = editText(index, removed, 1, 1, "u");
        expect(restored.text).toBe("Ou" + replacement + "tro");
        expect(restored.modifications).toEqual(replacement ? [...modification(spans, 1, 2, ""), ...modification(spans, 2, 2, "u" + replacement)] : []);
        expect(textPieces(index, restored)).toEqual(textPieces(index, projectText(index, restored.modifications)));
    });

    it("preserves different surviving source characters even when displayed strings match", () => {
        const spans = transcript(["aa"]);
        const index = createTextIndex(spans);
        const first = editText(index, projectText(index, []), 0, 1, "");
        const last = editText(index, projectText(index, []), 1, 2, "");
        expect(first.text).toBe(last.text);
        expect(first.modifications).not.toEqual(last.modifications);
        expect(textPieces(index, first).find(piece => piece.text === "a")?.sourceFrom).toBe(1);
        expect(textPieces(index, last).find(piece => piece.text === "a")?.sourceFrom).toBe(0);
    });

    it.each<{
        original: string;
        inserted: string;
        changes: [number, number, string][];
    }>([
        { original: "醬油 -", inserted: "酱油\n", changes: [[0, 4, ""], [4, 4, "酱油\n"]] },
        { original: "醬油", inserted: "好醬油啊", changes: [[0, 2, ""], [2, 2, "好醬油啊"]] },
        { original: "a😀中z", inserted: "b😀文z", changes: [[0, 4, ""], [4, 4, "b😀文z"]] },
        { original: "aaa", inserted: "aba", changes: [[1, 3, ""], [3, 3, "ba"]] },
        { original: "ab", inserted: "ba", changes: [[0, 2, ""], [2, 2, "ba"]] },
        { original: "abc", inserted: "XYZabc", changes: [[0, 3, ""], [3, 3, "XYZabc"]] }
    ])("never searches for middle or suffix matches for $original / $inserted", ({ original, inserted, changes }) => {
        const spans = transcript([...original]);
        const index = createTextIndex(spans);
        const value = editText(index, projectText(index, []), 0, index.characters.length, inserted);
        expect(value.text).toBe(inserted);
        expect(value.modifications).toEqual(changes.flatMap(([from, to, text]) => modification(spans, from, to, text)));
        expect(projectText(index, value.modifications)).toMatchObject({ text: inserted, modifications: value.modifications });
    });

    it("does not restore a middle character before an existing added line break", () => {
        const spans = transcript(["醬", "油", " -"]);
        const index = createTextIndex(spans);
        const removed = editText(index, projectText(index, []), 0, 4, "\n");
        const restored = editText(index, removed, 0, 0, "酱油");
        expect(restored.text).toBe("酱油\n");
        expect(restored.modifications).toEqual([
            ...modification(spans, 0, 4, ""), ...modification(spans, 4, 4, "酱油\n")
        ]);
        expect(textPieces(index, restored).filter(piece => piece.source.kind === "segment").map(piece => piece.text)).toEqual([]);
    });

    it("defers candidate restoration until the complete IME text is available", () => {
        const spans = transcript(["abc"]);
        const index = createTextIndex(spans);
        const removed = editText(index, projectText(index, []), 0, 3, "");
        let pending = editText(index, removed, 0, 0, "b", false);
        expect(pending.modifications).toEqual([...removed.modifications, ...modification(spans, 3, 3, "b")]);
        pending = editText(index, pending, 1, 1, "abc", false);
        const committed = commitText(index, removed, pending);
        expect(committed.text).toBe("babc");
        expect(committed.modifications).toEqual([...modification(spans, 0, 3, ""), ...modification(spans, 3, 3, "babc")]);
        expect(textPieces(index, committed)).toEqual(textPieces(index, projectText(index, committed.modifications)));
        expect(commitText(index, committed, committed)).toBe(committed);
    });

    it("keeps final restoration independent of provisional IME candidates", () => {
        checkProperty("composition-restoration", fc.property(transcriptArbitrary, fc.array(textArbitrary, { minLength: 1, maxLength: 8 }), (spans, candidates) => {
            const index = createTextIndex(spans);
            const removed = editText(index, projectText(index, []), 0, index.characters.length, "");
            let pending = removed;
            for (const text of candidates) pending = editText(index, pending, 0, pending.length, text, false);
            const committed = commitText(index, removed, pending);
            const direct = editText(index, removed, 0, 0, candidates.at(-1)!);
            expect(committed.modifications).toEqual(direct.modifications);
            expect(textPieces(index, committed)).toEqual(textPieces(index, direct));
        }));
    });

    it("keeps a provisional replacement from choosing between repeated source characters", () => {
        const spans = transcript(["a", "a", "a"]);
        const index = createTextIndex(spans);
        const saved = projectText(index, []);
        let pending = editText(index, saved, 1, 2, "b", false);
        pending = editText(index, pending, 0, 2, "ba", false);
        const committed = commitText(index, saved, pending);
        expect(committed.text).toBe("baa");
        expect(committed.modifications).toEqual([...modification(spans, 0, 2, ""), ...modification(spans, 2, 2, "ba")]);
        expect(textPieces(index, committed).filter(piece => piece.source.kind === "segment").map(piece => piece.sourceFrom)).toEqual([2]);
        const cancelled = editText(index, pending, 0, 1, "a", false);
        expect(commitText(index, saved, cancelled)).toBe(saved);
    });

    it.each<{
        original: string;
        initial: [number, number, string][];
        edits: [number, number, string][];
        expected: [number, number, string][];
        text: string;
    }>([
        { original: "outro", initial: [[3, 5, ""]], edits: [[3, 3, "r"]], expected: [[4, 5, ""]], text: "outr" },
        { original: "outro", initial: [[4, 5, ""]], edits: [[4, 4, "o"]], expected: [], text: "outro" },
        { original: "outro", initial: [[3, 5, ""]], edits: [[3, 3, "o"]], expected: [[3, 5, ""], [5, 5, "o"]], text: "outo" },
        { original: "outro", initial: [[3, 5, "u"]], edits: [[4, 4, "o"]], expected: [[3, 5, ""], [5, 5, "uo"]], text: "outuo" },
        { original: "oro", initial: [[1, 3, "ut"]], edits: [[1, 1, "r"]], expected: [[1, 3, ""], [3, 3, "rut"]], text: "orut" },
        { original: "oro", initial: [[1, 3, "ut"]], edits: [[1, 3, "ro"]], expected: [], text: "oro" },
        { original: "我们去公园玩", initial: [[3, 6, ""]], edits: [[3, 3, "公园"]], expected: [[5, 6, ""]], text: "我们去公园" },
        { original: "what", initial: [], edits: [[0, 4, "w"], [1, 1, "a"], [2, 2, "n"], [3, 3, "t"]], expected: [[1, 4, ""], [4, 4, "ant"]], text: "want" },
        { original: "what", initial: [], edits: [[0, 4, "that"]], expected: [[0, 4, ""], [4, 4, "that"]], text: "that" },
        { original: "天汽", initial: [], edits: [[0, 2, "天气"]], expected: [[1, 2, ""], [2, 2, "气"]], text: "天气" },
        { original: "outro", initial: [[2, 5, ""]], edits: [[0, 2, "outro"]], expected: [], text: "outro" },
        { original: "天汽", initial: [], edits: [[0, 0, "天气"], [2, 4, ""]], expected: [[0, 2, ""], [2, 2, "天气"]], text: "天气" }
    ])("matches only this edit at the deletion head: $original / $edits", ({ original, initial, edits, expected, text }) => {
        const spans = transcript([original]), index = createTextIndex(spans);
        let value = projectText(index, initial.flatMap(change => modification(spans, ...change)));
        for (const change of edits) value = editText(index, value, ...change);
        expect(value.text).toBe(text);
        expect(value.modifications).toEqual(expected.flatMap(change => modification(spans, ...change)));
    });

    it.each([
        ["what", "want", [[1, 3, ""], [3, 3, "an"]]],
        ["what", "that", [[0, 1, ""], [1, 1, "t"]]],
        ["天汽", "天气", [[1, 2, ""], [2, 2, "气"]]],
        ["😀中x", "😀文x", [[1, 2, ""], [2, 2, "文"]]],
        ["abXcd", "abYcd", [[2, 3, ""], [3, 3, "Y"]]],
        ["aaaa", "aa", [[2, 4, ""]]],
        ["what", "what", []],
        ["abc", "XbY", [[0, 3, ""], [3, 3, "XbY"]]]
    ] as [string, string, [number, number, string][]][])("aligns only the two ends of %s / %s", (original, added, expected) => {
        const spans = transcript([original]), index = createTextIndex(spans);
        const before = editText(index, projectText(index, []), 0, index.characters.length, added, false);
        const aligned = alignText(index, before, 0, before.length);
        expect(aligned.text).toBe(before.text);
        expect(aligned.modifications).toEqual(expected.flatMap(change => modification(spans, ...change)));
        expect(alignText(index, aligned, 0, aligned.length)).toBe(aligned);
    });

    it.each<[number, number, boolean]>([[1, 2, true], [0, 1, true], [0, 2, true], [2, 4, false], [1, 1, false]])("includes marker edges %i/%i without requiring selected original text", (from, to, included) => {
        const spans = transcript(["LwhatR"]), index = createTextIndex(spans);
        const before = editText(index, projectText(index, []), 1, 5, "want", false);
        const aligned = alignText(index, before, from, to);
        expect(aligned.text).toBe("LwantR");
        expect(aligned === before).toBe(!included);
        if (included) expect(aligned.modifications).toEqual([...modification(spans, 2, 4, ""), ...modification(spans, 4, 4, "an")]);
    });

    it("aligns random edits without changing display and leaves neither matching end", () => {
        checkProperty("explicit-alignment", fc.property(editingArbitrary, ({ spans, edits }) => {
            const index = createTextIndex(spans);
            let value = projectText(index, []);
            for (const edit of edits) {
                const { from, to } = editRange(index, value, edit);
                value = editText(index, value, from, to, edit.text, false);
            }
            const aligned = alignText(index, value, 0, value.length);
            expect(aligned.text).toBe(value.text);
            expect(textPieces(index, aligned).map(piece => piece.text).join("")).toBe(value.text);
            expect(alignText(index, aligned, 0, aligned.length)).toBe(aligned);
            expect(projectText(index, aligned.modifications).modifications).toEqual(aligned.modifications);
            aligned.modifications.forEach((deletion, i) => {
                const insertion = aligned.modifications[i + 1];
                if (deletion.type !== "delete" || insertion?.type !== "insert") return;
                const from = textOffset(index, deletion.range.start), to = textOffset(index, deletion.range.end);
                if (textOffset(index, insertion.pos) !== to) return;
                expect([...insertion.text][0]).not.toBe(index.characters[from]);
                expect([...insertion.text].at(-1)).not.toBe(index.characters[to - 1]);
            });
        }));
    });

    it("keeps explicit non-matching writes unchanged through later edits and reload", () => {
        const index = createTextIndex(transcript(["what tail"]));
        const replaced = editText(index, projectText(index, []), 0, 4, "what", false);
        expect(textPieces(index, replaced).find(piece => piece.text === "what")?.source.kind).toBe("modification");
        const next = editText(index, replaced, replaced.length, replaced.length, "!");
        const loaded = projectText(index, JSON.parse(JSON.stringify(next.modifications)));
        expect(loaded.modifications).toEqual(next.modifications);
        expect(textPieces(index, loaded).find(piece => piece.text === "what")?.source.kind).toBe("modification");
    });

    it("uses the full IME input range even when old and new added prefixes match", () => {
        const index = createTextIndex(transcript(["oro"]));
        const saved = editText(index, projectText(index, []), 1, 3, "rut", false);
        const pending = editText(index, saved, 1, 4, "ro", false);
        expect(commitText(index, saved, pending, { from: 1, to: 4, end: 3 }).modifications).toEqual([]);
    });

    it("commits an identical IME replacement using its recorded input range", () => {
        const index = createTextIndex(transcript(["oro"]));
        const saved = editText(index, projectText(index, []), 1, 3, "ro", false);
        const pending = editText(index, saved, 1, 3, "ro", false);
        expect(pending).toBe(saved);
        expect(commitText(index, saved, pending)).toBe(saved);
        expect(commitText(index, saved, pending, { from: 1, to: 3, end: 3 }).modifications).toEqual([]);
    });

    it("edits a long replacement with a matching source prefix", () => {
        const original = "ab".repeat(75000);
        const replacement = original.slice(0, -1) + "c";
        const index = createTextIndex(transcript([original]));
        const value = editText(index, projectText(index, []), 0, original.length, replacement);
        expect(value.modifications).toHaveLength(2);
        expect(value.text).toBe(replacement);
        const next = editText(index, value, value.length, value.length, "!");
        expect(next.text).toBe(replacement + "!");
        expect(textPieces(index, next).map(piece => piece.text).join("")).toBe(next.text);
    });

    it("restores each random deletion explicitly while preserving added text", () => {
        checkProperty("deletion-restoration", fc.property(editingArbitrary, ({ spans, edits }) => {
            const index = createTextIndex(spans);
            let projection = projectText(index, []);
            for (const edit of edits) {
                const range = editRange(index, projection, edit);
                projection = editText(index, projection, range.from, range.to, edit.text);
            }
            for (const deletion of projection.modifications) {
                if (deletion.type !== "delete") continue;
                const from = textOffset(index, deletion.range.start);
                const to = textOffset(index, deletion.range.end);
                const offset = projectedOffset(projection, from);
                const original = index.characters.slice(from, to).join("");
                const restored = restoreTextDeletion(index, projection, from, to);
                expect(restored.text).toBe(projection.text.slice(0, offset) + original + projection.text.slice(offset));
                for (const modification of restored.modifications) {
                    if (modification.type === "delete") {
                        expect(textOffset(index, modification.range.end) <= from || textOffset(index, modification.range.start) >= to).toBe(true);
                    }
                }
                expect(textPieces(index, restored)).toEqual(textPieces(index, projectText(index, restored.modifications)));
            }
        }));
    });
});