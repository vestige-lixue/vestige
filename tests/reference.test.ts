import { describe, expect, it } from "vitest";
import { referenceCandidate } from "../shared/transcript/reference";
import { project, transcript } from "./support/fixtures";

describe("reference candidates", () => {
    function run(values: [string, number, number][]): ReturnType<typeof project>["vestiges"][number]["runs"][number] {
        return project(values.map(([text, start, end]) => ({ ...transcript([text])[0], range: { start, end } }))).vestiges[0].runs[0];
    }

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