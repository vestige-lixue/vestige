import { VestigeErrors, isExpectedFailure } from "../../shared/failure";
import typia from "typia";
import { type Project } from "../../shared/project/Project";
import { type Range, type TextPosition } from "../../shared/util/range";
import { type Run } from "../../shared/transcription/Run";
import { configsEqual } from "../../shared/transcription/Config";
import { createTextIndex, normalizeModifications, type TextIndex } from "../../shared/transcript/text";
import { projectVersion } from "../../shared/project/constants";
import { type AbsolutePath } from "../../shared/util/path";
import { resolveMediaPath } from "./path";

// JSON stores plain strings; establish the path brand after structural validation.
type SerializedProject = Omit<Project, "version" | "vestiges"> & {
    // Keep the version text for the unsupported-version diagnostic.
    version: string;
    vestiges: Array<Omit<Project["vestiges"][number], "media"> & {
        media: Omit<Project["vestiges"][number]["media"], "path"> & { path: string };
    }>;
};

// Scalar constraints are generated from the shared types. These bounds depend on other fields.
function within(value: number, path: string, maximum: number, integer = false): number {
    if (value > maximum) {
        throw new VestigeErrors({ kind: "project-invalid-number", path, integer }, { cause: { value, maximum } });
    }
    return value;
}

function position(item: TextPosition, path: string, index: TextIndex): void {
    const segment = within(item.segmentIdx, `${path}.segmentIdx`, index.transcript.length, true);
    const maximum = segment === index.transcript.length ? 0 : index.starts[segment + 1] - index.starts[segment] - 1;
    within(item.offset, `${path}.offset`, maximum, true);
}

function timeRange(range: Range, path: string, maximum?: number): void {
    if (range.end < range.start) throw new VestigeErrors({ kind: "project-reversed-range", path });
    if (maximum !== undefined) within(range.end, `${path}.end`, maximum);
}

function execution(run: Run, path: string): void {
    const { request, plan, deviations, log } = run.execution;
    const invalid = (field: string, expected: string): never => {
        throw new VestigeErrors({ kind: "project-invalid-structure", path: `${path}.${field}`, expected });
    };
    if (!configsEqual(run.config, request) || plan.executor !== request.executor) invalid("request", "the Run's requested configuration and matching executor");
    if (log && log.taskId !== run.id) invalid("log.taskId", "the Run's task id");
    if (plan.segmentation.batchSize < 1) invalid("plan.segmentation.batchSize", "a positive batch size");
    let end = 0;
    const originals = new Set<string>();
    const key = (range: Range): string => `${range.start}:${range.end}`;
    plan.parts.forEach((part, index) => {
        timeRange(part, `${path}.plan.parts[${index}]`, plan.audio.duration);
        if (part.start !== end) invalid(`plan.parts[${index}]`, "contiguous planned audio parts starting at zero");
        if (plan.segmentation.maximumDuration !== null && part.end - part.start > plan.segmentation.maximumDuration + 1 / plan.audio.sampleRate) {
            invalid(`plan.parts[${index}]`, "a part within the planned duration limit");
        }
        originals.add(key(part));
        end = part.end;
    });
    if (!plan.parts.length || end !== plan.audio.duration) invalid("plan.parts", "complete coverage of the prepared audio");
    const changed = new Map<string, Range[]>();
    deviations.forEach((deviation, index) => {
        const field = `deviations[${index}]`;
        timeRange(deviation.originalRange, `${path}.${field}.originalRange`, plan.audio.duration);
        timeRange(deviation.range, `${path}.${field}.range`, deviation.originalRange.end);
        if (!originals.has(key(deviation.originalRange))) invalid(`${field}.originalRange`, "one of the planned audio parts");
        if (deviation.range.start < deviation.originalRange.start) invalid(`${field}.range`, "a final part contained in its original range");
        if (!deviation.reasons.length) invalid(`${field}.reasons`, "the reason for deviating from the plan");
        const ranges = changed.get(key(deviation.originalRange)) ?? [];
        ranges.push(deviation.range);
        changed.set(key(deviation.originalRange), ranges);
    });
    for (const part of plan.parts) {
        const ranges = changed.get(key(part));
        if (!ranges) continue;
        let end = part.start;
        for (const range of [...ranges].sort((left, right) => left.start - right.start)) {
            if (range.start !== end) invalid("deviations", "non-overlapping final parts covering each changed original range");
            end = range.end;
        }
        if (end !== part.end) invalid("deviations", "complete final coverage of each changed original range");
    }
}

export function parseProject(value: unknown, directory?: AbsolutePath): Project {
    const checked = typia.assertEquals<SerializedProject>(value, props => {
        const path = props.path?.replace(/^\$input/, "project") ?? "project";
        // Classify generated scalar failures without repeating their validation rules.
        if (typeof props.value === "number" && props.expected.includes("number")) {
            return new VestigeErrors({ kind: "project-invalid-number", path, integer: /\.(?:lastOpened|size|displayedRunIdx|startedAt|segmentIdx|offset|batchSize)$/.test(path) }, { cause: props });
        }
        if (typeof props.value === "string" && path.endsWith(".media.id")) {
            return new VestigeErrors({ kind: "project-invalid-uuid", path }, { cause: props });
        }
        return new VestigeErrors({ kind: "project-invalid-structure", path, expected: props.expected }, { cause: props });
    });
    if (checked.version !== projectVersion) throw new VestigeErrors({ kind: "project-version", version: checked.version });
    // Own every nested object before resolving paths or normalizing modifications.
    const project = structuredClone(checked);
    const mediaIds = new Set<string>();
    return {
        ...project,
        version: projectVersion,
        vestiges: project.vestiges.map((vestige, index) => {
            const path = `project.vestiges[${index}]`;
            const { media, runs } = vestige;
            if (mediaIds.has(media.id.toLowerCase())) throw new VestigeErrors({ kind: "project-duplicate-media", path: `${path}.media.id` });
            mediaIds.add(media.id.toLowerCase());
            let resolvedPath: AbsolutePath;
            try {
                resolvedPath = resolveMediaPath(media.path, directory);
            }
            catch (error) {
                if (!isExpectedFailure(error) || (error.failure.kind !== "path-not-absolute" && error.failure.kind !== "path-drive-relative")) throw error;
                throw new VestigeErrors({ kind: "project-invalid-path", path: `${path}.media.path` }, { cause: error });
            }
            within(vestige.playbackPosition, `${path}.playbackPosition`, media.duration);
            runs.forEach((run, index) => {
                const runPath = `${path}.runs[${index}]`;
                execution(run, `${runPath}.execution`);
                run.transcript.forEach((segment, index) => {
                    timeRange(segment.range, `${runPath}.transcript[${index}].range`);
                });
            });
            const displayed = within(vestige.displayedRunIdx, `${path}.displayedRunIdx`, Math.max(0, runs.length - 1), true);
            const textIndex = createTextIndex(runs[displayed]?.transcript ?? []);
            vestige.modifications.forEach((modification, index) => {
                const modificationPath = `${path}.modifications[${index}]`;
                if (modification.type === "insert") {
                    position(modification.pos, `${modificationPath}.pos`, textIndex);
                    return;
                }
                const { start, end } = modification.range;
                position(start, `${modificationPath}.range.start`, textIndex);
                position(end, `${modificationPath}.range.end`, textIndex);
                if (end.segmentIdx < start.segmentIdx || (end.segmentIdx === start.segmentIdx && end.offset < start.offset)) {
                    throw new VestigeErrors({ kind: "project-reversed-range", path: `${modificationPath}.range` });
                }
            });
            let modifications: Project["vestiges"][number]["modifications"];
            try {
                modifications = normalizeModifications(textIndex, vestige.modifications);
            }
            catch (cause) {
                throw new VestigeErrors({ kind: "project-invalid-structure", path: `${path}.modifications`, expected: "non-overlapping source deletions and valid insertions" }, { cause });
            }
            return { ...vestige, media: { ...media, path: resolvedPath }, modifications };
        })
    };
}