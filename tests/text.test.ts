import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
    createTextIndex, projectText, textPieces, projectionOffset, projectedOffset, editText, textPosition, textOffset, codepointToUtf16, utf16ToCodepoint, normalizeModifications,
    provenanceChange
} from "../shared/transcript/text";
import { modification, referenceText, sourcePosition, sourceOffset, transcript } from "./support/fixtures";
import { editingArbitrary, editRange, patchesArbitrary, transcriptArbitrary, normalizationArbitrary } from "./support/generators";
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
                if (expected.slice(range.from, range.to).join("") !== edit.text) {
                    provenance.splice(range.from, range.to - range.from, ...[...edit.text].map(text => ({ text, source: null })));
                }
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
                // D18 may restore newly inserted characters; surviving original characters keep their identity.
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

    it("normalizes source-anchored operations and restores matching source without changing displayed text", () => {
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
                    const deletion = deletions.find(range => range.to === position);
                    if (deletion) {
                        const inserted = [...item.text];
                        const deleted = index.characters.slice(deletion.from, deletion.to);
                        expect(inserted[0]).not.toBe(deleted[0]);
                        expect(inserted.at(-1)).not.toBe(deleted.at(-1));
                        for (let length = 1; length <= Math.min(inserted.length, deleted.length); length++) {
                            expect(inserted.slice(0, length).join("")).not.toBe(deleted.slice(-length).join(""));
                        }
                    }
                }
            }
            expect(modifications).toEqual(before);
        }));
    });

    it.each([
        { original: "Outro", from: 3, to: 4, inserted: "ar", insertion: [3, "a"] as const, deletion: null, text: "Outaro" },
        { original: "Outro", from: 2, to: 4, inserted: "t", insertion: null, deletion: [3, 4] as const, text: "Outo" },
        { original: "Outro", from: 2, to: 4, inserted: "r", insertion: null, deletion: [2, 3] as const, text: "Ouro" },
        { original: "rx", from: 0, to: 2, inserted: "ar", insertion: [2, "ar"] as const, deletion: [0, 2] as const, text: "ar" },
        { original: "Outro", from: 0, to: 5, inserted: "Outro", insertion: null, deletion: null, text: "Outro" },
        { original: "𝄞中x", from: 0, to: 3, inserted: "a𝄞中", insertion: [3, "a𝄞中"] as const, deletion: [0, 3] as const, text: "a𝄞中" },
        { original: "rx", from: 0, to: 2, inserted: "xa", insertion: [2, "a"] as const, deletion: [0, 1] as const, text: "xa" },
        { original: "𝄞中x", from: 0, to: 3, inserted: "中xa", insertion: [3, "a"] as const, deletion: [0, 1] as const, text: "中xa" }
    ])("restores D18 source boundaries for $original / $inserted", ({ original, from, to, inserted, insertion, deletion, text }) => {
        const spans = transcript([...original]);
        const index = createTextIndex(spans);
        const removed = editText(index, projectText(index, []), from, to, "");
        const value = editText(index, removed, from, from, inserted);
        const expected = [
            ...deletion ? modification(spans, deletion[0], deletion[1], "") : [],
            ...insertion ? modification(spans, insertion[0], insertion[0], insertion[1]) : []
        ];
        expect(value.text).toBe(text);
        expect(value.modifications).toEqual(expected);
        expect(normalizeModifications(index, value.modifications)).toEqual(expected);
        expect(textPieces(index, value)).toEqual(textPieces(index, projectText(index, expected)));
    });

    it("reports source restored outside the edited range", () => {
        const index = createTextIndex(transcript(["ab"]));
        let value = editText(index, projectText(index, []), 0, 2, "");
        value = editText(index, value, 0, 0, "x");
        value = editText(index, value, 1, 1, "a");
        const next = editText(index, value, 0, 1, "");
        expect(textPieces(index, next).filter(piece => piece.text).map(piece => piece.source.kind)).toEqual(["segment"]);
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

    it.each(["", "h"])("restores a deletion by typing its original before replacement %s", replacement => {
        const spans = transcript(["Outro"]);
        const index = createTextIndex(spans);
        const removed = editText(index, projectText(index, []), 1, 2, replacement);
        const restored = editText(index, removed, 1, 1, "u");
        expect(restored.text).toBe("Ou" + replacement + "tro");
        expect(restored.modifications).toEqual(modification(spans, 2, 2, replacement));
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
});