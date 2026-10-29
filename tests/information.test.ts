import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { transcriptEvents, transcriptInformation, transcriptSelection, transcriptSelectionUnits } from "../renderer/editor/informationModel";
import { createTextIndex, projectText, editText } from "../shared/transcript/text";
import { modification, transcript } from "./support/fixtures";
import { editingArbitrary, editRange } from "./support/generators";
import { checkProperty } from "./support/properties";
import { middlePreview, previewUnits, comparisonPreview } from "../renderer/editor/preview";

describe("transcriptInformation", () => {
    it("finds the complement of unsorted, overlapping speech intervals clipped to duration", () => {
        const spans = transcript(["😀", "x", "y", "", "z"]);
        const ranges = [{ start: 4, end: 6 }, { start: 1, end: 3 }, { start: 2, end: 5 }, { start: 0, end: 9 }, { start: 12, end: 15 }];
        spans.forEach((span, index) => span.range = ranges[index]);
        const index = createTextIndex(spans);
        const items = transcriptInformation(index, projectText(index, []), 10);
        expect(items.filter(item => item.kind === "gap").map(item => ({ range: item.range, from: item.from, to: item.to }))).toEqual([
            { range: { start: 0, end: 1 }, from: 2, to: 2 },
            { range: { start: 6, end: 10 }, from: 5, to: 5 }
        ]);
    });

    it("keeps deleted source audio and existing gaps when deletion crosses spans", () => {
        const spans = transcript(["ab", "cd"]);
        spans[0].range = { start: 0, end: 2 };
        spans[1].range = { start: 4, end: 6 };
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 1, 3, ""));
        const items = transcriptInformation(index, projection, 8);
        expect(projection.text).toBe("ad");
        expect(items.find(item => item.kind === "deletion")).toMatchObject({
            from: 1, to: 1, original: "bc", range: { start: 0, end: 6 }, probability: null, blankProbability: null,
            gaps: [{ sourceFrom: 2, range: { start: 2, end: 4 } }]
        });
        expect(items.filter(item => item.kind === "gap").map(item => item.range)).toEqual([
            { start: 6, end: 8 }
        ]);
    });

    it("assigns no source audio or confidence to insertions and uses UTF-16 offsets", () => {
        const spans = transcript(["a😀b"]);
        const index = createTextIndex(spans);
        const items = transcriptInformation(index, projectText(index, modification(spans, 1, 1, "X")), 1);
        expect(items.map(item => ({ kind: item.kind, from: item.from, to: item.to, probability: item.probability }))).toEqual([
            { kind: "token", from: 0, to: 1, probability: 0.8 },
            { kind: "token", from: 2, to: 5, probability: 0.8 }
        ]);
    });

    it("anchors whole-run deletion and empty-run gaps at EOF without adding text", () => {
        const spans = transcript(["😀x"]);
        const index = createTextIndex(spans);
        const items = transcriptInformation(index, projectText(index, modification(spans, 0, 2, "")), 2);
        expect(items.find(item => item.kind === "deletion")).toMatchObject({
            from: 0, to: 0, original: "😀x", range: { start: 0, end: 1 },
            gaps: [{ from: 0, to: 0, sourceFrom: 2, range: { start: 1, end: 2 } }]
        });
        expect(items.some(item => item.kind === "gap")).toBe(false);
        const empty = createTextIndex([]);
        expect(transcriptInformation(empty, projectText(empty, []), 3)).toMatchObject([
            { kind: "gap", from: 0, to: 0, range: { start: 0, end: 3 } }
        ]);
    });

    it("keeps the deleted u marker before inserted h in Outro (D20)", () => {
        const spans = transcript(["O", "u", "t", "r", "o"]);
        const index = createTextIndex(spans);
        const deleted = editText(index, projectText(index, []), 1, 2, "");
        const inserted = editText(index, deleted, 1, 1, "h");
        const items = transcriptInformation(index, inserted, 9);
        expect(inserted.text).toBe("Ohtro");
        expect(items.filter(item => item.kind === "deletion")).toMatchObject([
            { original: "u", from: 1, to: 1, range: { start: 2, end: 3 }, probability: null, blankProbability: null }
        ]);
        expect(items.some(item => item.kind === "token" && item.from < 2 && item.to > 1)).toBe(false);
    });

    it("maps a source gap inside a deletion to its marker before inserted text", () => {
        const spans = transcript(["ab", "cd"]);
        const index = createTextIndex(spans);
        const value = projectText(index, modification(spans, 1, 3, "😀"));
        const items = transcriptInformation(index, value, 3);
        expect(value.text).toBe("a😀d");
        expect(items.find(item => item.kind === "deletion")).toMatchObject({
            from: 1, to: 1, original: "bc", gaps: [{ from: 1, to: 1, sourceFrom: 2, range: { start: 1, end: 2 } }]
        });
        expect(items.some(item => item.kind === "gap")).toBe(false);
    });

    it("absorbs gaps at both deletion boundaries without extending its audio range", () => {
        const spans = transcript(["a", "b", "c"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 1, 2, ""));
        for (const items of [transcriptEvents(index, projection, 5), transcriptInformation(index, projection, 5)]) {
            expect(items.filter(item => item.kind === "deletion")).toMatchObject([{
                from: 1, range: { start: 2, end: 3 }, sourceFrom: 1, sourceTo: 2,
                gaps: [
                    { key: "gap-1-2", sourceFrom: 1, range: { start: 1, end: 2 } },
                    { key: "gap-3-4", sourceFrom: 2, range: { start: 3, end: 4 } }
                ]
            }]);
            expect(items.some(item => item.kind === "gap")).toBe(false);
        }
    });

    it("keeps the terminal gap independent after replacement text", () => {
        const spans = transcript(["a", "b", "c"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 1, 2, "X"));
        const items = transcriptEvents(index, projection, 5);
        expect(items).toMatchObject([
            { kind: "deletion", from: 1, range: { start: 2, end: 3 }, gaps: [{ key: "gap-1-2", sourceFrom: 1 }] },
            { kind: "gap", from: 2, sourceFrom: 2, range: { start: 3, end: 4 } }
        ]);
    });

    it("has at most one pure marker per displayed position after random edits and arbitrary timings", () => {
        const timing = fc.array(fc.tuple(fc.integer({ min: -3, max: 30 }), fc.integer({ min: -3, max: 30 })), { minLength: 6, maxLength: 6 });
        checkProperty("event-ownership", fc.property(editingArbitrary, timing, fc.integer({ min: 1, max: 30 }), ({ spans, edits }, ranges, duration) => {
            spans.forEach((span, position) => span.range = { start: ranges[position][0], end: ranges[position][1] });
            const index = createTextIndex(spans);
            let projection = projectText(index, []);
            for (const edit of edits) {
                const range = editRange(index, projection, edit);
                projection = editText(index, projection, range.from, range.to, edit.text);
                const events = transcriptEvents(index, projection, duration);
                expect(new Set(events.map(event => event.from)).size).toBe(events.length);
                expect(transcriptInformation(index, projection, duration).filter(item => item.kind !== "token")).toEqual(events);
                const keys = events.flatMap(event => [event.key, ...event.gaps?.map(gap => gap.key) ?? []]);
                expect(new Set(keys).size).toBe(keys.length);
                for (const event of events) {
                    expect(["deletion", "gap"]).toContain(event.kind);
                    for (const gap of event.gaps ?? []) {
                        expect(event.kind).toBe("deletion");
                        expect(gap.kind).toBe("gap");
                        expect(gap.from).toBe(event.from);
                    }
                }
            }
        }));
    });
});

describe("information previews", () => {
    it("preserves spaces, tabs and line breaks as original text", () => {
        const display = (text: string): string => previewUnits(text, "deleted").flat().map(part => part.text).join("");
        expect(display(" a b  c\t\r\n ")).toBe(" a b  c\t\r\n ");
        expect(display(" \t\n\u00a0")).toBe(" \t\n\u00a0");
        expect(display("a b")).toBe("a b");
    });

    it("keeps complete combining and emoji graphemes on both sides of a middle omission", () => {
        const units = previewUnits("e\u0301👩‍🔬abcdef🇨🇳", "deleted");
        expect(middlePreview(units, 3).flat().map(part => part.text).join("")).toBe("e\u0301👩‍🔬…🇨🇳");
        expect(middlePreview(units, units.length)).toBe(units);
    });

    it("places absorbed gaps at source positions and drops markers in omitted text", () => {
        const spans = transcript(["a", "b", "c", "d"]);
        const index = createTextIndex(spans);
        const deletion = transcriptEvents(index, projectText(index, modification(spans, 0, 4, "")), 8)[0];
        const units = previewUnits(deletion.original!, "deleted", deletion.gaps, deletion.sourceFrom);
        expect(units.flat().map(part => part.text).join("")).toBe("a▼b▼c▼d▼");
        expect(middlePreview(units, 2).flat().map(part => part.text).join("")).toBe("a…▼d▼");
    });
});

describe("selection information", () => {
    it("keeps zero-duration deletions available to selection view commands", () => {
        const spans = transcript(["a", "b", "c"]);
        spans.forEach(span => span.range = { start: 0, end: 0 });
        const index = createTextIndex(spans);
        const projection = editText(index, projectText(index, []), 1, 2, "X");
        expect(transcriptSelection(index, projection, 1, 1, 2)).toBeNull();
        expect(transcriptSelectionUnits(index, projection, 1, 1, 2).deletions.map(item => item.original)).toEqual(["b"]);
        expect(transcriptSelectionUnits(index, projection, 1, 0, 1).deletions).toEqual([]);
        expect(transcriptSelectionUnits(index, projection, 1, 0, 2).deletions.map(item => item.original)).toEqual(["b"]);
    });

    it("outlines the union of touched tokens without covering inserted text", () => {
        const spans = transcript(["hello", " world"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 2, 2, "X"));
        expect(transcriptSelection(index, projection, 3, 3, 4)).toMatchObject({
            kind: "selection", from: 0, to: 6, tokens: [0], fragments: [{ from: 0, to: 2 }, { from: 3, to: 6 }],
            range: { start: 0, end: 1 }, probability: null, blankProbability: null
        });
        expect(transcriptSelection(index, projection, 3, 4, 9)).toMatchObject({
            from: 0, to: 12, tokens: [0, 1], fragments: [{ from: 0, to: 2 }, { from: 3, to: 12 }], range: { start: 0, end: 3 }
        });
    });

    it("includes a token selected only by its leading space", () => {
        const index = createTextIndex(transcript(["hello", " world"]));
        expect(transcriptSelection(index, projectText(index, []), 3, 0, 6)).toMatchObject({
            from: 0, to: 11, tokens: [0, 1], fragments: [{ from: 0, to: 11 }], range: { start: 0, end: 3 }
        });
    });

    it("includes whitespace tokens in both mixed and whitespace-only selections", () => {
        const index = createTextIndex(transcript(["a ", "\t", " b"]));
        const projection = projectText(index, []);
        expect(transcriptSelection(index, projection, 5, 1, 4)).toMatchObject({ from: 0, to: 5, tokens: [0, 1, 2], range: { start: 0, end: 5 } });
        expect(transcriptSelection(index, projection, 5, 0, 3)).toMatchObject({ tokens: [0, 1], range: { start: 0, end: 3 } });
    });

    it("includes boundary deletions only when their replacement text is selected", () => {
        const spans = transcript(["O", "u", "tro"]);
        const index = createTextIndex(spans);
        const replacement = projectText(index, modification(spans, 1, 2, "h"));
        expect(transcriptSelection(index, replacement, 5, 1, 2)).toMatchObject({
            tokens: [], fragments: [], deletions: [{ original: "u" }], range: { start: 2, end: 3 }
        });
        expect(transcriptSelection(index, replacement, 5, 0, 1)).toMatchObject({ deletions: [], range: { start: 0, end: 1 } });
        expect(transcriptSelection(index, replacement, 5, 2, 3)).toMatchObject({ deletions: [], range: { start: 4, end: 5 } });
        const removed = projectText(index, modification(spans, 1, 2, ""));
        expect(transcriptSelection(index, removed, 5, 0, 2)).toMatchObject({ deletions: [{ original: "u" }] });
        expect(transcriptSelection(index, removed, 5, 1, 2)).toMatchObject({ deletions: [] });
    });

    it("assigns no audio to ordinary insertion-only selections and excludes gaps", () => {
        const spans = transcript(["a", "b"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 1, 1, "X"));
        expect(transcriptSelection(index, projection, 10, 1, 2)).toBeNull();
        expect(transcriptSelection(index, projection, 10, 1, 3)).toMatchObject({
            from: 1, to: 3, fragments: [{ from: 2, to: 3 }], range: { start: 2, end: 3 }
        });
    });

    it("takes the envelope of unsorted overlapping times and clips it to duration", () => {
        const spans = transcript(["a", "b", "c"]);
        spans[0].range = { start: 7, end: 14 };
        spans[1].range = { start: -2, end: 3 };
        spans[2].range = { start: 2, end: 9 };
        const index = createTextIndex(spans);
        const projection = projectText(index, []);
        expect(transcriptSelection(index, projection, 10, 0, 2)?.range).toEqual({ start: 0, end: 10 });
        expect(transcriptSelection(index, projection, 10, 1, 3)?.range).toEqual({ start: 0, end: 9 });
        expect(transcriptSelection(index, projection, 6, 0, 1)).toBeNull();
        expect(transcriptSelection(index, projection, 10, 0, 1)?.key).not.toBe(transcriptSelection(index, projection, 10, 0, 2)?.key);
    });
});

describe("selection comparison", () => {
    it("preserves ordinary spaces in unchanged context across token boundaries", () => {
        expect(comparisonPreview([
            { kind: "original", text: "to " }, { kind: "original", text: "the " },
            { kind: "deleted", text: "store" }, { kind: "inserted", text: "shop" }, { kind: "original", text: " now" }
        ]).flat().map(part => part.text).join("")).toBe("to the storeshop now");
    });
    it("preserves matching prefix and middle source in the comparison", () => {
        const spans = transcript(["store"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 0, 5, "shop"));
        expect(transcriptSelection(index, projection, 1, 0, 4)?.comparison).toEqual([
            { kind: "original", text: "s" }, { kind: "deleted", text: "t" }, { kind: "inserted", text: "h" },
            { kind: "original", text: "o" }, { kind: "deleted", text: "re" }, { kind: "inserted", text: "p" }
        ]);
        expect(transcriptSelection(index, projectText(index, []), 1, 0, 5)?.comparison).toEqual([]);
    });

    it("keeps independent modifications at their actual character boundaries", () => {
        const spans = transcript(["one", "two", "three"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, [...modification(spans, 1, 2, "X"), ...modification(spans, 4, 5, "Y")]);
        expect(transcriptSelection(index, projection, 5, 0, projection.text.length)?.comparison).toEqual([
            { kind: "original", text: "o" }, { kind: "deleted", text: "n" }, { kind: "inserted", text: "X" },
            { kind: "original", text: "e" }, { kind: "original", text: "t" },
            { kind: "deleted", text: "w" }, { kind: "inserted", text: "Y" },
            { kind: "original", text: "o" }, { kind: "original", text: "three" }
        ]);
    });

    it("preserves surviving characters around a deletion across tokens", () => {
        const spans = transcript(["one", "two", "three"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 1, 5, "X"));
        expect(transcriptSelection(index, projection, 5, 0, projection.text.length)?.comparison).toEqual([
            { kind: "original", text: "o" }, { kind: "deleted", text: "netw" }, { kind: "inserted", text: "X" },
            { kind: "original", text: "o" }, { kind: "original", text: "three" }
        ]);
    });

    it("renders only the deleted prefix of next without inventing an inserted t", () => {
        const spans = transcript(["see", " you", " next", " time"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 7, 11, ""));
        expect(projection.text).toBe("see yout time");
        expect(transcriptEvents(index, projection, 7).find(item => item.kind === "deletion")?.original).toBe(" nex");
        expect(transcriptSelection(index, projection, 7, 0, projection.text.length)?.comparison).toEqual([
            { kind: "original", text: "see" }, { kind: "original", text: " you" },
            { kind: "deleted", text: " nex" }, { kind: "original", text: "t" }, { kind: "original", text: " time" }
        ]);
    });

    it("preserves deleted whitespace and supplementary characters verbatim", () => {
        const spans = transcript(["a \t\n😀b"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 1, 5, ""));
        expect(transcriptSelection(index, projection, 1, 0, 2)?.comparison).toEqual([
            { kind: "original", text: "a" }, { kind: "deleted", text: " \t\n😀" }, { kind: "original", text: "b" }
        ]);
    });

    it("shows an insertion inside a token without marking original characters as changed", () => {
        const spans = transcript(["hello"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 2, 2, "X"));
        expect(transcriptSelection(index, projection, 1, 0, projection.text.length)?.comparison).toEqual([
            { kind: "original", text: "he" }, { kind: "inserted", text: "X" }, { kind: "original", text: "llo" }
        ]);
    });

    it("shows a boundary-only insertion without replacing its neighboring tokens", () => {
        const spans = transcript(["a", "b"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 1, 1, "X"));
        expect(transcriptSelection(index, projection, 3, 0, 3)?.comparison).toEqual([
            { kind: "original", text: "a" }, { kind: "inserted", text: "X" }, { kind: "original", text: "b" }
        ]);
    });

    it("limits comparison to the expanded selection, including a replacement-only selection", () => {
        const spans = transcript(["a😀b", "other"]);
        const index = createTextIndex(spans);
        const projection = projectText(index, modification(spans, 1, 2, "X"));
        expect(transcriptSelection(index, projection, 3, 1, 2)?.comparison).toEqual([
            { kind: "deleted", text: "😀" }, { kind: "inserted", text: "X" }
        ]);
        expect(transcriptSelection(index, projection, 3, 4, 6)?.comparison).toEqual([]);
        const removed = projectText(index, modification(spans, 0, 3, ""));
        expect(transcriptSelection(index, removed, 3, 0, 2)?.comparison).toEqual([]);
    });

    it("keeps two context tokens on each side of changes and folds longer unchanged runs", () => {
        const spans = transcript(Array.from({ length: 15 }, (_, i) => String.fromCharCode(65 + i)));
        const index = createTextIndex(spans);
        const projection = projectText(index, [...modification(spans, 3, 4, "x"), ...modification(spans, 10, 11, "y")]);
        expect(transcriptSelection(index, projection, 30, 0, 15)?.comparison).toEqual([
            { kind: "ellipsis", text: "…" }, { kind: "original", text: "B" }, { kind: "original", text: "C" },
            { kind: "deleted", text: "D" }, { kind: "inserted", text: "x" },
            { kind: "original", text: "E" }, { kind: "original", text: "F" }, { kind: "ellipsis", text: "…" },
            { kind: "original", text: "I" }, { kind: "original", text: "J" },
            { kind: "deleted", text: "K" }, { kind: "inserted", text: "y" },
            { kind: "original", text: "L" }, { kind: "original", text: "M" }, { kind: "ellipsis", text: "…" }
        ]);
    });
});