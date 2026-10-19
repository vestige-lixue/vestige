import { VestigeErrors } from "../../shared/failure";
import typia from "typia";
import { type Project } from "../../shared/project/Project";
import { type TextPosition } from "../../shared/util/range";
import { createTextIndex, normalizeModifications, type TextIndex } from "../../shared/transcript/text";
import { projectVersion } from "../../shared/project/constants";
import { InvalidPathFailure, storedFilePath } from "../util/file";

export class ProjectValidationFailure extends VestigeErrors {}

// JSON stores plain strings; establish the path brand after structural validation.
type SerializedProject = Omit<Project, "version" | "vestiges"> & {
    // Keep the version text for the unsupported-version diagnostic.
    version: string;
    vestiges: Array<Omit<Project["vestiges"][number], "media"> & {
        media: Omit<Project["vestiges"][number]["media"], "path"> & { path: string };
    }>;
};

function number(value: number, path: string, max = Infinity, integer = false): number {
    if (!Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isSafeInteger(value))) {
        throw new ProjectValidationFailure({ kind: "project-invalid-number", path, integer }, { cause: { value, maximum: max } });
    }
    return value;
}

function position(item: TextPosition, path: string, index: TextIndex): void {
    const segment = number(item.segmentIdx, `${path}.segmentIdx`, index.transcript.length, true);
    const maximum = segment === index.transcript.length ? 0 : index.starts[segment + 1] - index.starts[segment] - 1;
    number(item.offset, `${path}.offset`, maximum, true);
}

export function validateProject(value: unknown): asserts value is Project {
    // Typia generates the structural checks directly from the shared TS type.
    const project = typia.assertEquals<SerializedProject>(value, props => new ProjectValidationFailure({
        kind: "project-invalid-structure", path: props.path ?? "project", expected: props.expected
    }));
    if (project.version !== projectVersion) throw new ProjectValidationFailure({ kind: "project-version", version: project.version });
    number(project.lastOpened, "project.lastOpened", Number.MAX_SAFE_INTEGER, true);
    const mediaIds = new Set<string>();
    project.vestiges.forEach((vestige, index) => {
        const path = `project.vestiges[${index}]`;
        const { media, runs } = vestige;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(media.id)) {
            throw new ProjectValidationFailure({ kind: "project-invalid-uuid", path: `${path}.media.id` });
        }
        if (mediaIds.has(media.id.toLowerCase())) throw new ProjectValidationFailure({ kind: "project-duplicate-media", path: `${path}.media.id` });
        mediaIds.add(media.id.toLowerCase());
        try {
            media.path = storedFilePath(media.path);
        }
        catch (error) {
            if (!(error instanceof InvalidPathFailure)) throw error;
            throw new ProjectValidationFailure({ kind: "project-invalid-path", path: `${path}.media.path` }, { cause: error });
        }
        number(media.size, `${path}.media.size`, Number.MAX_SAFE_INTEGER, true);
        if (!Number.isFinite(media.mtimeMs)) {
            throw new ProjectValidationFailure({ kind: "project-invalid-structure", path: `${path}.media.mtimeMs`, expected: "finite timestamp" });
        }
        const duration = number(media.duration, `${path}.media.duration`);
        number(vestige.playbackPosition, `${path}.playbackPosition`, duration);
        runs.forEach((run, index) => {
            const runPath = `${path}.runs[${index}]`;
            number(run.languageProb, `${runPath}.languageProb`, 1);
            number(run.runTime, `${runPath}.runTime`);
            number(run.startedAt, `${runPath}.startedAt`, 8_640_000_000_000_000, true);
            run.transcript.forEach((segment, index) => {
                const segmentPath = `${runPath}.transcript[${index}]`;
                const start = number(segment.range.start, `${segmentPath}.range.start`);
                const end = number(segment.range.end, `${segmentPath}.range.end`);
                if (end < start) throw new ProjectValidationFailure({ kind: "project-reversed-range", path: `${segmentPath}.range` });
                number(segment.blankProb, `${segmentPath}.blankProb`, 1);
                number(segment.token.prob, `${segmentPath}.token.prob`, 1);
            });
        });
        const displayed = number(vestige.displayedRunIdx, `${path}.displayedRunIdx`, Math.max(0, runs.length - 1), true);
        const textIndex = createTextIndex(runs[displayed]?.transcript ?? []);
        vestige.modifications.forEach((modification, index) => {
            const modificationPath = `${path}.modifications[${index}]`;
            if (modification.type === "insert") {
                position(modification.pos, `${modificationPath}.pos`, textIndex);
            }
            else {
                const { start, end } = modification.range;
                position(start, `${modificationPath}.range.start`, textIndex);
                position(end, `${modificationPath}.range.end`, textIndex);
                if (end.segmentIdx < start.segmentIdx || (end.segmentIdx === start.segmentIdx && end.offset < start.offset)) {
                    throw new ProjectValidationFailure({ kind: "project-reversed-range", path: `${modificationPath}.range` });
                }
            }
        });
        try {
            vestige.modifications = normalizeModifications(textIndex, vestige.modifications);
        }
        catch (cause) {
            throw new ProjectValidationFailure({ kind: "project-invalid-structure", path: `${path}.modifications`, expected: "non-overlapping text modifications" }, { cause });
        }
    });
}