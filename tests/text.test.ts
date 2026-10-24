import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
    createTextIndex, projectText, editText, textPosition, textOffset, codepointToUtf16, utf16ToCodepoint
} from "../shared/transcript/text";
import { modification, referenceText, sourcePosition, transcript } from "./support/fixtures";
import { editingArbitrary, editRange, patchesArbitrary, transcriptArbitrary } from "./support/generators";
import { checkProperty } from "./support/properties";

describe("text projection and editing", () => {
    it("projects original-coordinate changes like an independent string reference", () => {
        checkProperty("projection-equivalence", fc.property(patchesArbitrary, ({ spans, modifications }) => {
            const original = structuredClone({ spans, modifications });
            const index = createTextIndex(spans);
            const projection = projectText(index, modifications);
            expect(projection.text).toBe(referenceText(spans, modifications));
            expect(projection.pieces.map(piece => piece.text).join("")).toBe(projection.text);
            let offset = 0;
            for (const piece of projection.pieces) {
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
            for (const edit of edits) {
                const range = editRange(projection, edit);
                const before = structuredClone(projection);
                const next = editText(index, projection, range.from, range.to, edit.text);
                expected.splice(range.from, range.to - range.from, ...edit.text);
                expect(next.text).toBe(expected.join(""));
                expect(next.length).toBe(expected.length);
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
        expect(() => projectText(index, [modification(spans, 2, 1, "")])).toThrow(RangeError);
        expect(() => projectText(index, [modification(spans, 0, 2, ""), modification(spans, 1, 2, "x")])).toThrow(RangeError);
        const projection = projectText(index, []);
        for (const [from, to] of [[-1, 0], [1, 0], [0, 3], [0, 0.5]]) {
            expect(() => editText(index, projection, from, to, "")).toThrow(RangeError);
        }
    });
});