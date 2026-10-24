import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { ProjectValidationFailure, validateProject } from "../main/project/validate";
import { createTextIndex, projectText, editText } from "../shared/transcript/text";
import { type Project } from "../shared/project/Project";
import { type AbsolutePath } from "../shared/util/path";
import { project, sourceOffset, transcript, modification } from "./support/fixtures";
import { editingArbitrary, editRange } from "./support/generators";
import { checkProperty } from "./support/properties";

function expectFailure(value: unknown, kind: string): void {
    try {
        validateProject(value);
    }
    catch (error) {
        expect(error).toBeInstanceOf(ProjectValidationFailure);
        expect((error as ProjectValidationFailure).failure.kind).toBe(kind);
        return;
    }
    throw new Error("The project unexpectedly passed validation.");
}

describe("project validation contract through the real typia transform", () => {
    it("accepts a complete legal project (transform canary)", () => {
        expect(() => validateProject(project())).not.toThrow();
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
            validateProject(restored);
            expect(projectText(index, restored.vestiges[0].modifications).text).toBe(projection.text);
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
        validateProject(serialized, directory);
        expect(serialized.vestiges[0].media.path).toBe(process.platform === "win32" ? "C:\\project\\audio.wav" : "/project/audio.wav");
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
});