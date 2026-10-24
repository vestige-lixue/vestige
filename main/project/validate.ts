import { VestigeErrors, isExpectedFailure } from "../../shared/failure";
import typia from "typia";
import { type Project } from "../../shared/project/Project";
import { type TextPosition } from "../../shared/util/range";
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

export function parseProject(value: unknown, directory?: AbsolutePath): Project {
    const checked = typia.assertEquals<SerializedProject>(value, props => {
        const path = props.path?.replace(/^\$input/, "project") ?? "project";
        // Classify generated scalar failures without repeating their validation rules.
        if (typeof props.value === "number" && props.expected.includes("number")) {
            return new VestigeErrors({ kind: "project-invalid-number", path, integer: /\.(?:lastOpened|size|displayedRunIdx|startedAt|segmentIdx|offset)$/.test(path) }, { cause: props });
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
                run.transcript.forEach((segment, index) => {
                    if (segment.range.end < segment.range.start) {
                        throw new VestigeErrors({ kind: "project-reversed-range", path: `${runPath}.transcript[${index}].range` });
                    }
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