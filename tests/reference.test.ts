import { describe, expect, it } from "vitest";
import { matchReferencePosition, matchReferenceRange, referenceCandidate, referencePane, type ReferencePane } from "../shared/transcript/reference";
import { editText, editTextRanges, projectionOffset, projectionSlice, textPieces } from "../shared/transcript/text";
import { defaultSettings } from "../shared/settings/defaults";
import { referenceReplacement, type ReferenceReplacementRequest } from "../renderer/editor/referenceReplacement";
import { project, transcript } from "./support/fixtures";

function run(values: [string, number, number][]): ReturnType<typeof project>["vestiges"][number]["runs"][number] {
    return project(values.map(([text, start, end]) => ({ ...transcript([text])[0], range: { start, end } }))).vestiges[0].runs[0];
}

function pane(...texts: string[]): ReferencePane {
    return referencePane(project(transcript(texts)).vestiges[0].runs[0]);
}

describe("reference candidates", () => {
    it.each([0, 50, 100])("includes wide and narrow tokens at %i percent", threshold => {
        const source = run([["wide", 0, 10], [" narrow", 4, 5]]);
        expect(referenceCandidate(source, { start: 3, end: 7 }, threshold)).toEqual({ text: "wide narrow", range: { start: 0, end: 10 }, tokens: [0, 1] });
    });

    it.each<[number, string | undefined]>([[0, "ab"], [50, "ab"], [51, "b"], [100, "b"]])("uses an inclusive threshold of %i", (threshold, text) => {
        expect(referenceCandidate(run([["a", 0, 4], ["b", 2, 4], ["outside", 8, 9]]), { start: 2, end: 6 }, threshold)?.text).toBe(text);
    });

    it("does not include disjoint or merely touching intervals at zero percent", () => {
        expect(referenceCandidate(run([["before", 0, 1], ["after", 2, 3]]), { start: 1, end: 2 }, 0)).toBeNull();
    });

    it.each([0, 100])("includes zero-duration tokens at either boundary at %i percent", threshold => {
        expect(referenceCandidate(run([["a", 1, 1], ["b", 2, 2], ["c", 3, 3], ["d", 4, 4]]), { start: 1, end: 3 }, threshold))
            .toEqual({ text: "abc", range: { start: 1, end: 3 }, tokens: [0, 1, 2] });
    });

    it("handles a point target without division by zero", () => {
        expect(referenceCandidate(run([["wide", 0, 5], ["point", 2, 2], ["later", 3, 4]]), { start: 2, end: 2 }, 100)?.text).toBe("widepoint");
    });

    it("finds overlapping intervals in time order but joins them in Run order", () => {
        const source = run([[" late", 8, 10], [" early", 0, 100], [" gap", 1, 2], [" middle", 7, 9]]);
        const saved = structuredClone(source);
        expect(referenceCandidate(source, { start: 8, end: 9 }, 100)).toEqual({ text: " late early middle", range: { start: 0, end: 100 }, tokens: [0, 1, 3] });
        expect(referenceCandidate(source, { start: 50, end: 51 }, 100)?.tokens).toEqual([1]);
        expect(source).toEqual(saved);
    });

    it("keeps exact decimal boundaries and all whitespace", () => {
        expect(referenceCandidate(run([[" a ", 0.1, 0.5]]), { start: 0.3, end: 0.7 }, 50)?.text).toBe(" a ");
    });

    it("returns no candidate for empty text or an empty Run", () => {
        expect(referenceCandidate(run([["", 0, 10]]), { start: 1, end: 2 }, 0)).toBeNull();
        expect(referenceCandidate(run([]), { start: 0, end: 0 }, 0)).toBeNull();
    });
});

describe("reference text alignment", () => {
    const base = referencePane(run([["😀 President ", 0, 2], ["Tipton", 2, 3], [", Mr. Vice President", 3, 5]]));
    const turbo = referencePane(run([["😀 President ", 0, 1.3], ["Pitzer", 1.3, 2.3], [", Mr. Vice President", 2.3, 4.3]]));
    const time = { start: 2, end: 3 };

    function select({ projection }: ReferencePane, text: string, from = 0): { from: number; to: number } {
        const offset = projection.text.indexOf(text, from);
        return { from: projectionOffset(projection, offset, false), to: projectionOffset(projection, offset + text.length, false) };
    }

    it.each(["Tipton", "ipt", "Tip"])("expands %j to the whole difference across shifted timestamps", text => {
        const match = matchReferenceRange(base, turbo, select(base, text), time)!;
        expect(match.source).toEqual(select(base, "Tipton"));
        expect(match.target).toEqual(select(turbo, "Pitzer"));
        expect(match.differences).toEqual([{ source: match.source, target: match.target }]);
    });

    it("maps boundaries within a shared anchor without expanding them", () => {
        const match = matchReferenceRange(base, turbo, select(base, "Pres"), { start: 0, end: 2 })!;
        expect(match.source).toEqual(select(base, "Pres"));
        expect(match.target).toEqual(select(turbo, "Pres"));
        expect(match.differences).toEqual([]);
    });

    it("does not anchor on common pieces shorter than three codepoints inside a difference", () => {
        const source = pane("start AxyB end"), target = pane("start CxyD end");
        const match = matchReferenceRange(source, target, select(source, "xy"), time)!;
        expect(match.differences).toEqual([{ source: select(source, "AxyB"), target: select(target, "CxyD") }]);
    });

    it("widens the time window until it has anchors on both sides of a long difference", () => {
        const source = referencePane(run([["Opening ", 0, 1], ["AAAA", 11, 12], ["BBBB", 24, 25], [" ending", 40, 41]]));
        const target = referencePane(run([["Opening ", 0, 1], ["CCCC", 11, 12], ["DDDD", 24, 25], [" ending", 40, 41]]));
        const match = matchReferenceRange(source, target, select(source, "BB"), { start: 24, end: 25 })!;
        expect(match.source).toEqual(select(source, "AAAABBBB"));
        expect(match.target).toEqual(select(target, "CCCCDDDD"));
    });

    it("uses a document edge as an anchor only when both windows reach it", () => {
        const source = referencePane(run([["ABC", 20, 21]]));
        const target = referencePane(run([["left ", 0, 1], ["XYZ", 20, 21], [" right", 40, 41]]));
        const match = matchReferenceRange(source, target, select(source, "B"), { start: 20, end: 21 })!;
        expect(match.source).toEqual({ from: 0, to: 3 });
        expect(match.target).toEqual({ from: 0, to: target.projection.length });
    });

    it.each<[string, number]>([["xyz", 6], ["xy", 5], ["yabc", 1], ["axc", 2]])("pairs abc with %j at an edit distance of %i", (text, distance) => {
        const source = pane("abc"), target = pane(text);
        expect(matchReferenceRange(source, target, { from: 0, to: 3 }, time, { editDistance: distance - 1 })).toBeNull();
        expect(matchReferenceRange(source, target, { from: 0, to: 3 }, time, { editDistance: distance })).not.toBeNull();
    });

    it("rejects an oversized window on either side", () => {
        const short = pane("abc"), long = pane("abc xyz");
        expect(matchReferenceRange(short, long, { from: 0, to: 1 }, time, { codepoints: 6 })).toBeNull();
        expect(matchReferenceRange(long, short, { from: 0, to: 1 }, time, { codepoints: 6 })).toBeNull();
    });

    it("finds only nonempty insertions at a position", () => {
        const source = pane("Opening  ending"), target = pane("Opening extra ending");
        expect(matchReferencePosition(source, target, 8, time)).toEqual(select(target, "extra"));
        expect(matchReferencePosition(source, target, 2, time)).toBe(false);
        expect(matchReferencePosition(base, turbo, select(base, "ipt").from, time)).toBe(false);
        expect(matchReferencePosition(source, target, 8, time, { codepoints: 5 })).toBeNull();
    });

    it("matches visible additions and skips deleted source text in either direction", () => {
        const selected = select(base, "Tipton");
        const edited = { ...base, projection: editText(base.index, base.projection, selected.from, selected.to, "Pitzer", false) };
        const change = select(edited, "Pitzer");
        expect(matchReferenceRange(edited, turbo, change, null)?.target).toEqual(select(turbo, "Pitzer"));
        expect(matchReferenceRange(turbo, edited, select(turbo, "Pitzer"), { start: 1.3, end: 2.3 })?.target).toEqual(change);
    });

    it("reports just the changed codepoints in unspaced Chinese text", () => {
        const source = pane("学而时习之，不亦说乎"), target = pane("学而是习之，不亦悦乎");
        const match = matchReferenceRange(source, target, { from: 0, to: source.projection.length }, time)!;
        expect(match.differences).toEqual([
            { source: select(source, "时"), target: select(target, "是") },
            { source: select(source, "说"), target: select(target, "悦") }
        ]);
    });

    it("maps a deletion to an empty target interval", () => {
        const source = pane("will be ", "a ", "very brief"), target = pane("will be ", "very brief");
        const selection = select(source, "a");
        const match = matchReferenceRange(source, target, selection, time)!;
        expect(match.target).toEqual({ from: 8, to: 8 });
        expect(projectionSlice(source.projection, match.source)).toBe("a ");
        expect(referenceReplacement(source, target, { kind: "selection", selection, tokens: [1], range: time }, defaultSettings.editing)?.display)
            .toEqual({ kind: "comparison", parts: [{ kind: "deleted", text: "a " }] });
    });

    it("uses the nearest visible timed characters on both sides of an addition without selected timing", () => {
        const original = referencePane(run([["Opening ", 0, 1], [" ending", 100, 101]]));
        const source = { ...original, projection: editText(original.index, original.projection, 8, 8, "extra", false) };
        const target = referencePane(run([["Opening ", 0, 1], ["extra", 49, 50], [" ending", 100, 101]]));
        expect(matchReferenceRange(source, target, select(source, "extra"), null)?.target).toEqual(select(target, "extra"));
        const untimed = { ...original, projection: editText(original.index, original.projection, 0, original.projection.length, "extra", false) };
        expect(matchReferenceRange(untimed, target, select(untimed, "extra"), null)).toBeNull();
    });

    it("writes only Tipton when its selection starts inside the preceding anchor", () => {
        const request = { kind: "selection", selection: select(base, "dent Tip"), tokens: [0, 1], range: { start: 0, end: 3 } } as const;
        const { edits, display } = referenceReplacement(base, turbo, request, defaultSettings.editing)!;
        expect(edits).toEqual([{ ...select(base, "Tipton"), text: "Pitzer" }]);
        expect(display).toEqual({ kind: "comparison", parts: [
            { kind: "original", text: "dent " }, { kind: "deleted", text: "Tipton" }, { kind: "inserted", text: "Pitzer" }
        ] });
        const result = editTextRanges(base.index, base.projection, edits);
        expect(textPieces(base.index, result).find(piece => piece.text.endsWith("dent "))?.source.kind).toBe("segment");
    });

    it("inserts only two commas and keeps the rest of the sentence's provenance", () => {
        const source = pane("We meet at a college noted for knowledge", " in a city noted for progress", " in a state noted for strength");
        const target = pane("We meet at a college noted for knowledge,", " in a city noted for progress,", " in a state noted for strength");
        const first = select(source, "knowledge").to, second = select(source, "progress").to;
        const request = { kind: "selection", selection: { from: 0, to: second + 1 }, tokens: [0, 1, 2], range: { start: 0, end: 5 } } as const;
        const { edits, display } = referenceReplacement(source, target, request, defaultSettings.editing)!;
        expect(edits).toEqual([{ from: first, to: first, text: "," }, { from: second, to: second, text: "," }]);
        const beforeSecond = referenceReplacement(source, target, { ...request, selection: { from: 0, to: second } }, defaultSettings.editing);
        expect(beforeSecond?.edits).toEqual([edits[0]]);
        expect(display.kind === "comparison" && display.parts.filter(part => part.kind !== "original")).toEqual([
            { kind: "inserted", text: "," }, { kind: "inserted", text: "," }
        ]);
        const result = editTextRanges(source.index, source.projection, edits);
        expect(result.text).toBe(target.projection.text);
        expect(textPieces(source.index, result).filter(piece => piece.source.kind === "segment").map(piece => piece.text).join("")).toBe(source.projection.text);
    });

    it("preserves an unselected addition and previews the actual edits between the anchors", () => {
        const position = select(base, "Tip").to;
        const source = { ...base, projection: editText(base.index, base.projection, position, position, "X", false) };
        const request = { kind: "selection", selection: select(source, "Tip"), tokens: [1], range: time } as const;
        const { edits, display } = referenceReplacement(source, turbo, request, defaultSettings.editing)!;
        expect(display.kind === "comparison" && display.parts).toEqual([
            { kind: "deleted", text: "Tip" }, { kind: "inserted", text: "Pitzer" }, { kind: "original", text: "X" }, { kind: "deleted", text: "ton" }
        ]);
        expect(editTextRanges(source.index, source.projection, edits).text).toContain("PitzerX,");
    });

    it("does not fall back for a matched gap with no text there or a selection with no edits", () => {
        const source = pane("Opening  ending"), target = pane("Opening extra ending");
        const gap = { kind: "gap", position: 2, range: { start: 0, end: 1 } } as const;
        expect(referenceReplacement(source, target, gap, defaultSettings.editing)).toBeNull();
        expect(referenceReplacement(source, target, gap, { ...defaultSettings.editing, referenceMatching: "time" })?.display)
            .toEqual({ kind: "timing", text: "Opening extra ending", range: gap.range, target: gap.range });
        const selection: ReferenceReplacementRequest = { kind: "selection", selection: { from: 0, to: 5 }, tokens: [0], range: gap.range };
        expect(referenceReplacement(source, target, selection, defaultSettings.editing)).toBeNull();
        expect(referenceReplacement(source, target, { ...gap, position: 8 }, defaultSettings.editing)).toEqual({
            edits: [{ from: 8, to: 8, text: "extra" }], display: { kind: "comparison", parts: [{ kind: "inserted", text: "extra" }] }
        });
    });

    it("falls back to a time candidate for a Run whose text cannot be aligned", () => {
        const source = pane("a".repeat(16385)), target = pane("replacement");
        const request = { kind: "selection", selection: { from: 0, to: source.projection.length }, tokens: [0], range: { start: 0, end: 1 } } as const;
        expect(referenceReplacement(source, target, request, defaultSettings.editing)?.display.kind).toBe("timing");
    });
});