import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { parseProject } from "../main/project/validate";
import { VestigeErrors } from "../shared/failure";
import { validMediaHash } from "../shared/media/check";
import { createTextIndex, projectText, editText } from "../shared/transcript/text";
import { type Project } from "../shared/project/Project";
import { type AbsolutePath } from "../shared/util/path";
import { project, sourceOffset, transcript, modification } from "./support/fixtures";
import { editingArbitrary, editRange } from "./support/generators";
import { checkProperty } from "./support/properties";

function expectFailure(value: unknown, kind: string, directory?: AbsolutePath): VestigeErrors["failure"] {
    try {
        parseProject(value, directory);
    }
    catch (error) {
        expect(error).toBeInstanceOf(VestigeErrors);
        expect((error as VestigeErrors).failure.kind).toBe(kind);
        return (error as VestigeErrors).failure;
    }
    throw new Error("The project unexpectedly passed validation.");
}

function objectReferences(value: unknown, references = new Set<object>()): Set<object> {
    if (value === null || typeof value !== "object" || references.has(value)) return references;
    references.add(value);
    for (const child of Object.values(value)) objectReferences(child, references);
    return references;
}

describe("project validation contract through the real typia transform", () => {
    it("accepts a complete legal project (transform canary)", () => {
        expect(() => parseProject(project())).not.toThrow();
    });

    it("rejects structurally invalid input through the generated checker (transform canary)", () => {
        const legal = project();
        const invalid = { ...legal, vestiges: [{ ...legal.vestiges[0], media: { ...legal.vestiges[0].media, duration: "one" } }] };
        expectFailure(invalid, "project-invalid-structure");
        expectFailure({ ...project(), unexpected: 1 }, "project-invalid-structure");
    });

    it("keeps random edits valid in original Run coordinates and after JSON round-trip", () => {
        checkProperty("project-persistence", fc.property(editingArbitrary, ({ spans, edits }) => {
            const index = createTextIndex(spans);
            let projection = projectText(index, []);
            for (const edit of edits) {
                const { from, to } = editRange(projection, edit);
                projection = editText(index, projection, from, to, edit.text);
                for (const item of projection.modifications) {
                    const start = sourceOffset(spans, item.type === "insert" ? item.pos : item.range.start);
                    const end = sourceOffset(spans, item.type === "insert" ? item.pos : item.range.end);
                    expect(start).toBeGreaterThanOrEqual(0);
                    expect(end).toBeGreaterThanOrEqual(start);
                    expect(end).toBeLessThanOrEqual(index.characters.length);
                }
            }
            const original = structuredClone(projection.modifications);
            const restored: unknown = JSON.parse(JSON.stringify(project(spans, projection.modifications)));
            const parsed = parseProject(restored);
            expect(projectText(index, parsed.vestiges[0].modifications).text).toBe(projection.text);
            expect(projection.modifications).toEqual(original);
        }));
    });

    it("rejects impossible original coordinates and invalid numeric/domain relations", () => {
        const mutations: { change: (value: Project) => void; kind: string }[] = [
            { change: value => value.vestiges[0].media.duration = NaN, kind: "project-invalid-number" },
            { change: value => value.vestiges[0].runs[0].transcript[0].range = { start: 2, end: 1 }, kind: "project-reversed-range" },
            { change: value => value.vestiges.push(structuredClone(value.vestiges[0])), kind: "project-duplicate-media" },
            { change: value => value.vestiges[0].modifications = [{ type: "insert", pos: { segmentIdx: 1, offset: 1 }, text: "x" }], kind: "project-invalid-number" },
            { change: value => value.vestiges[0].modifications = [{ type: "delete", range: { start: { segmentIdx: 0, offset: 2 }, end: { segmentIdx: 0, offset: 1 } } }], kind: "project-reversed-range" }
        ];
        for (const mutation of mutations) {
            const value = project();
            mutation.change(value);
            expectFailure(value, mutation.kind);
        }
    });

    it("resolves relative media paths against the supplied project directory", () => {
        const legal = project();
        const serialized = { ...legal, vestiges: [{ ...legal.vestiges[0], media: { ...legal.vestiges[0].media, path: "audio.wav" } }] };
        const directory = (process.platform === "win32" ? "C:\\project" : "/project") as AbsolutePath;
        const parsed = parseProject(serialized, directory);
        expect(serialized.vestiges[0].media.path).toBe("audio.wav");
        expect(parsed.vestiges[0].media.path).toBe(process.platform === "win32" ? "C:\\project\\audio.wav" : "/project/audio.wav");
    });

    it("rejects overlapping modifications rather than silently accepting a different project", () => {
        const spans = transcript(["abcd"]);
        expectFailure(project(spans, [...modification(spans, 0, 3, "x"), ...modification(spans, 2, 4, "")]), "project-invalid-structure");
    });

    it("rejects replacement records and fields outside the insert/delete union", () => {
        const valid = project();
        const source = { segmentIdx: 0, offset: 0 };
        for (const item of [
            { range: { start: source, end: source }, text: "x" },
            { type: "replace", range: { start: source, end: source }, text: "x" },
            { type: "insert", pos: source, text: "x", range: { start: source, end: source } },
            { type: "delete", range: { start: source, end: source }, text: "" }
        ]) {
            expectFailure({ ...valid, vestiges: [{ ...valid.vestiges[0], modifications: [item] }] }, "project-invalid-structure");
        }
    });

    it("returns a deeply independent object while resolving paths and normalizing modifications", () => {
        const spans = transcript(["abcd"]);
        const original = project(spans, [
            ...modification(spans, 2, 3, ""),
            ...modification(spans, 1, 2, ""),
            ...modification(spans, 2, 2, "X")
        ]);
        original.vestiges[0].runs[0].config = { ...original.vestiges[0].runs[0].config, params: { prompt: "fixture" } };
        const input = { ...original, vestiges: [{ ...original.vestiges[0], media: { ...original.vestiges[0].media, path: "audio.wav" } }] };
        const before = structuredClone(input);
        const references = objectReferences(input);
        for (const reference of references) Object.freeze(reference);
        const directory = (process.platform === "win32" ? "C:\\project" : "/project") as AbsolutePath;
        const parsed = parseProject(input, directory);
        expect(input).toEqual(before);
        expect(parsed.vestiges[0].media.path).toBe(process.platform === "win32" ? "C:\\project\\audio.wav" : "/project/audio.wav");
        expect(parsed.vestiges[0].modifications).toHaveLength(2);
        expect(projectText(createTextIndex(spans), parsed.vestiges[0].modifications).text).toBe("aXd");
        for (const reference of objectReferences(parsed)) expect(references.has(reference)).toBe(false);
        parsed.vestiges[0].runs[0].transcript[0].token.text = "owned";
        parsed.vestiges[0].runs[0].transcript.push(...transcript(["new"]));
        expect(input).toEqual(before);
        const again = parseProject(input, directory);
        const parsedReferences = objectReferences(parsed);
        for (const reference of objectReferences(again)) expect(parsedReferences.has(reference)).toBe(false);
    });

    it("leaves the complete input untouched when a later domain check fails", () => {
        const spans = transcript(["abcd"]);
        const first = project(spans, [...modification(spans, 1, 2, ""), ...modification(spans, 2, 3, "")]).vestiges[0];
        const input = {
            ...project(),
            vestiges: [
                { ...first, media: { ...first.media, path: "audio.wav" } },
                { ...structuredClone(first), media: { ...first.media, path: "other.wav" } }
            ]
        };
        const before = structuredClone(input);
        const directory = (process.platform === "win32" ? "C:\\project" : "/project") as AbsolutePath;
        expectFailure(input, "project-duplicate-media", directory);
        expect(input).toEqual(before);
        expect(input.vestiges[0].media.path).toBe("audio.wav");
        expect(input.vestiges[0].modifications).toHaveLength(2);
    });

    it("enforces shared scalar tags without relaxing finite, probability or integer bounds", () => {
        const changes: { change: (value: Project) => void; integer: boolean }[] = [
            { change: value => value.lastOpened = Number.MAX_SAFE_INTEGER + 1, integer: true },
            { change: value => value.lastOpened = 0.5, integer: true },
            { change: value => value.vestiges[0].media.size = Number.MAX_SAFE_INTEGER + 1, integer: true },
            { change: value => value.vestiges[0].media.size = -1, integer: true },
            { change: value => value.vestiges[0].media.size = 0.5, integer: true },
            { change: value => value.vestiges[0].media.duration = Infinity, integer: false },
            { change: value => value.vestiges[0].media.duration = -Infinity, integer: false },
            { change: value => value.vestiges[0].media.duration = NaN, integer: false },
            { change: value => value.vestiges[0].playbackPosition = -1, integer: false },
            { change: value => value.vestiges[0].displayedRunIdx = 0.5, integer: true },
            { change: value => value.vestiges[0].runs[0].startedAt = 8640000000000001, integer: true },
            { change: value => value.vestiges[0].runs[0].runTime = Infinity, integer: false },
            { change: value => value.vestiges[0].runs[0].languageProb = 1.01, integer: false },
            { change: value => value.vestiges[0].runs[0].transcript[0].blankProb = -0.01, integer: false },
            { change: value => value.vestiges[0].runs[0].transcript[0].token.prob = NaN, integer: false },
            { change: value => value.vestiges[0].runs[0].transcript[0].range.end = Infinity, integer: false },
            { change: value => value.vestiges[0].modifications = [{ type: "insert", pos: { segmentIdx: 0.5, offset: 0 }, text: "x" }], integer: true },
            { change: value => value.vestiges[0].modifications = [{ type: "delete", range: { start: { segmentIdx: 0, offset: -1 }, end: { segmentIdx: 1, offset: 0 } } }], integer: true }
        ];
        for (const { change, integer } of changes) {
            const input = project();
            change(input);
            expect(expectFailure(input, "project-invalid-number")).toMatchObject({ integer });
        }
        const boundary = project();
        boundary.lastOpened = Number.MAX_SAFE_INTEGER;
        boundary.vestiges[0].media.size = Number.MAX_SAFE_INTEGER;
        boundary.vestiges[0].media.duration = Number.MAX_VALUE;
        boundary.vestiges[0].runs[0].startedAt = 8640000000000000;
        boundary.vestiges[0].runs[0].languageProb = 0;
        boundary.vestiges[0].runs[0].transcript[0].blankProb = 1;
        boundary.vestiges[0].runs[0].transcript[0].token.prob = 0;
        expect(() => parseProject(boundary)).not.toThrow();
    });

    it("keeps domain diagnostics and the empty-Run coordinate rules", () => {
        expect(expectFailure({ ...project(), version: "unsupported" }, "project-version")).toMatchObject({ version: "unsupported" });
        const empty = project();
        empty.vestiges[0].runs = [];
        expect(() => parseProject(empty)).not.toThrow();
        empty.vestiges[0].displayedRunIdx = 1;
        expectFailure(empty, "project-invalid-number");
        const gaps = project(transcript(["", "a", ""]));
        gaps.vestiges[0].modifications = [{ type: "insert", pos: { segmentIdx: 0, offset: 0 }, text: "x" }];
        expectFailure(gaps, "project-invalid-number");
        gaps.vestiges[0].modifications = [{ type: "insert", pos: { segmentIdx: 3, offset: 0 }, text: "x" }];
        expect(() => parseProject(gaps)).not.toThrow();
        const playback = project();
        playback.vestiges[0].playbackPosition = playback.vestiges[0].media.duration + 1;
        expectFailure(playback, "project-invalid-number");
    });

    it("keeps UUID v4 case handling and the dedicated UUID diagnostic", () => {
        const valid = project();
        valid.vestiges[0].media.id = "ABCDEFAB-CDEF-4ABC-ABCD-ABCDEFABCDEF";
        expect(() => parseProject(valid)).not.toThrow();
        for (const id of ["not-a-uuid", "abcdefab-cdef-1abc-abcd-abcdefabcdef", valid.vestiges[0].media.id + "\n"]) {
            expect(expectFailure({ ...valid, vestiges: [{ ...valid.vestiges[0], media: { ...valid.vestiges[0].media, id } }] }, "project-invalid-uuid"))
                .toMatchObject({ path: "project.vestiges[0].media.id" });
        }
        const duplicate = structuredClone(valid.vestiges[0]);
        duplicate.media.id = duplicate.media.id.toLowerCase();
        valid.vestiges.push(duplicate);
        expectFailure(valid, "project-duplicate-media");
    });

    it("uses the same real generated MediaHash constraint for guards and project parsing", () => {
        for (const hash of ["0123456789abcdef", "0000000000000000"]) {
            expect(validMediaHash(hash)).toBe(true);
            const input = project();
            input.vestiges[0].media.hash = hash;
            expect(() => parseProject(input)).not.toThrow();
        }
        for (const hash of ["0123456789abcde", "0123456789abcdef0", "0123456789abcdeF", "0123456789abcdef\n", "g123456789abcdef", null]) {
            expect(validMediaHash(hash)).toBe(false);
            const input = project();
            expect(expectFailure({ ...input, vestiges: [{ ...input.vestiges[0], media: { ...input.vestiges[0].media, hash } }] }, "project-invalid-structure"))
                .toMatchObject({ path: "project.vestiges[0].media.hash" });
        }
    });
});