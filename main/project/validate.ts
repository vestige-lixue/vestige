import { FailureError } from "../../shared/failure";
import typia from "typia";
import { type Project } from "../../shared/project/Project";
import { type Segment } from "../../shared/transcription/Run";
import { type TextPosition } from "../../shared/util/range";
import { projectVersion } from "../../shared/project/constants";
import { InvalidPathError, storedFilePath } from "../util/file";

export class ProjectValidationError extends FailureError {}

// JSON stores plain strings; establish the path brand after structural validation.
type SerializedProject = Omit<Project, "vestiges"> & {
    vestiges: Array<Omit<Project["vestiges"][number], "media"> & {
        media: Omit<Project["vestiges"][number]["media"], "path"> & { path: string };
    }>;
};

function number(value: number, path: string, max = Infinity, integer = false): number {
    if (!Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isSafeInteger(value))) {
        throw new ProjectValidationError({ kind: "project-invalid-number", path, integer });
    }
    return value;
}

function position(item: TextPosition, path: string, transcript: Segment[]): void {
    const segment = number(item.segmentIdx, `${path}.segmentIdx`, Math.max(0, transcript.length - 1), true);
    const text = transcript[segment]?.token.text ?? "";
    number(item.offset, `${path}.offset`, text.length, true);
}

export function validateProject(value: unknown): asserts value is Project {
    // Typia generates the structural checks directly from the shared TS type.
    const project = typia.assert<SerializedProject>(value, props => new ProjectValidationError({
        kind: "project-invalid-structure", path: props.path ?? "project", expected: props.expected
    }));
    if (project.version !== projectVersion) throw new ProjectValidationError({ kind: "project-version", version: project.version });
    number(project.lastOpened, "project.lastOpened", Number.MAX_SAFE_INTEGER, true);
    const mediaIds = new Set<string>();
    project.vestiges.forEach((vestige, index) => {
        const path = `project.vestiges[${index}]`;
        const { media, runs } = vestige;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(media.id)) {
            throw new ProjectValidationError({ kind: "project-invalid-uuid", path: `${path}.media.id` });
        }
        if (mediaIds.has(media.id.toLowerCase())) throw new ProjectValidationError({ kind: "project-duplicate-media", path: `${path}.media.id` });
        mediaIds.add(media.id.toLowerCase());
        try {
            media.path = storedFilePath(media.path);
        }
        catch (error) {
            if (!(error instanceof InvalidPathError)) throw error;
            throw new ProjectValidationError({ kind: "project-invalid-path", path: `${path}.media.path` }, { cause: error });
        }
        number(media.size, `${path}.media.size`, Number.MAX_SAFE_INTEGER, true);
        const duration = number(media.duration, `${path}.media.duration`);
        runs.forEach((run, index) => {
            const runPath = `${path}.runs[${index}]`;
            number(run.languageProb, `${runPath}.languageProb`, 1);
            number(run.runTime, `${runPath}.runTime`);
            run.transcript.forEach((segment, index) => {
                const segmentPath = `${runPath}.transcript[${index}]`;
                const start = number(segment.range.start, `${segmentPath}.range.start`, duration);
                const end = number(segment.range.end, `${segmentPath}.range.end`, duration);
                if (end < start) throw new ProjectValidationError({ kind: "project-reversed-range", path: `${segmentPath}.range` });
                number(segment.blankProb, `${segmentPath}.blankProb`, 1);
                number(segment.token.prob, `${segmentPath}.token.prob`, 1);
            });
        });
        const primary = number(vestige.primaryRunIdx, `${path}.primaryRunIdx`, Math.max(0, runs.length - 1), true);
        const transcript = runs[primary]?.transcript ?? [];
        vestige.modifications.forEach((modification, index) => {
            const modificationPath = `${path}.modifications[${index}]`;
            if (modification.type === "insert") {
                position(modification.pos, `${modificationPath}.pos`, transcript);
            }
            else {
                const { start, end } = modification.range;
                position(start, `${modificationPath}.range.start`, transcript);
                position(end, `${modificationPath}.range.end`, transcript);
                if (end.segmentIdx < start.segmentIdx || (end.segmentIdx === start.segmentIdx && end.offset < start.offset)) {
                    throw new ProjectValidationError({ kind: "project-reversed-range", path: `${modificationPath}.range` });
                }
            }
        });
    });
}