import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { transcriptEvents, transcriptInformation } from "../renderer/editor/informationModel";
import { createTextIndex, projectText, editText } from "../shared/transcript/text";
import { modification, transcript } from "./support/fixtures";
import { editingArbitrary, editRange } from "./support/generators";
import { checkProperty } from "./support/properties";

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