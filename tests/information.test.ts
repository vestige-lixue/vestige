import { describe, expect, it } from "vitest";
import { transcriptInformation } from "../renderer/editor/informationModel";
import { createTextIndex, projectText, editText } from "../shared/transcript/text";
import { modification, transcript } from "./support/fixtures";

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
            from: 1, to: 1, original: "bc", range: { start: 0, end: 6 }, probability: null, blankProbability: null
        });
        expect(items.filter(item => item.kind === "gap").map(item => item.range)).toEqual([
            { start: 2, end: 4 }, { start: 6, end: 8 }
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
        expect(items.find(item => item.kind === "deletion")).toMatchObject({ from: 0, to: 0, original: "😀x" });
        expect(items.find(item => item.kind === "gap")).toMatchObject({ from: 0, to: 0, range: { start: 1, end: 2 } });
        const empty = createTextIndex([]);
        expect(transcriptInformation(empty, projectText(empty, []), 3)).toMatchObject([
            { kind: "gap", from: 0, to: 0, range: { start: 0, end: 3 } }
        ]);
    });

    it("keeps the deleted u marker after inserting h in Outro (R5)", () => {
        const spans = transcript(["O", "u", "t", "r", "o"]);
        const index = createTextIndex(spans);
        const deleted = editText(index, projectText(index, []), 1, 2, "");
        const inserted = editText(index, deleted, 1, 1, "h");
        const items = transcriptInformation(index, inserted, 9);
        expect(inserted.text).toBe("Ohtro");
        expect(items.filter(item => item.kind === "deletion")).toMatchObject([
            { original: "u", from: 2, to: 2, range: { start: 2, end: 3 }, probability: null, blankProbability: null }
        ]);
        expect(items.some(item => item.kind === "token" && item.from < 2 && item.to > 1)).toBe(false);
    });

    it("maps a source gap inside a deletion to its marker after inserted text", () => {
        const spans = transcript(["ab", "cd"]);
        const index = createTextIndex(spans);
        const value = projectText(index, modification(spans, 1, 3, "😀"));
        const items = transcriptInformation(index, value, 3);
        expect(value.text).toBe("a😀d");
        expect(items.find(item => item.kind === "gap")).toMatchObject({ from: 3, to: 3, range: { start: 1, end: 2 } });
        expect(items.find(item => item.kind === "deletion")).toMatchObject({ from: 3, to: 3, original: "bc" });
    });
});