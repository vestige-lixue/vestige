import { type FailureInfo } from "../../shared/failure";
import { type Project } from "../../shared/project/Project";
import { type ProjectSaveSnapshot } from "../../shared/project/file";
import { type Run } from "../../shared/transcription/Run";
import { type Media } from "../../shared/Media";
import { type Vestige } from "../../shared/Vestige";
import { getFileName as getPathFileName, type AbsolutePath } from "../../shared/util/path";

type ProjectLifecycleOperation = {
    kind: "new" | "close" | "quit";
};

type ProjectOpenOperation = {
    kind: "open";
    path: AbsolutePath | null;
};

type ProjectReadOperation = {
    kind: "read";
    path: AbsolutePath;
};

type ProjectSaveOperation = {
    kind: "save";
    path: AbsolutePath | null;
    saveAs: boolean;
};

type ProjectWaitSaveOperation = {
    kind: "wait-save";
    fileName: string | null;
};

export type ProjectOperation = (
    ProjectLifecycleOperation |
    ProjectOpenOperation |
    ProjectReadOperation |
    ProjectSaveOperation |
    ProjectWaitSaveOperation
);

export type ProjectError = ({
    kind: "pending-imports" | "active-transcriptions" | "active-downloads";
} | {
    kind: "operation-failed";
    failure: FailureInfo;
} | {
    kind: "read-failed";
    path: AbsolutePath;
    failure: FailureInfo;
});

export type ProjectState = {
    path: AbsolutePath | null;
    project: Project | null;
    locked: boolean;
    operation: ProjectOperation | null;
    saving: boolean;
    error: ProjectError | null;
};

export const projectState = $state<ProjectState>({
    path: null, project: null, locked: false, operation: null, saving: false, error: null
});
export const saveConfirmation = $state<{ pending: boolean; fileName: string | null; error: FailureInfo | null }>({
    pending: false, fileName: null, error: null
});

export function getFileName(): string | null {
    return projectState.path === null ? null : getPathFileName(projectState.path);
}

// Every media row looks up its Vestige, often before its import has added one. One reactive slot per id
// notifies only the affected row; a scan, a derived index or a SvelteMap (whose missing keys share one
// version signal) reruns every row on each import, which is quadratic for large imports.
// Only these functions change the project or its Vestige list, so the slots stay in sync.
// Pending imports prepare their slots before rendering: state created inside a row's derived
// lookup would not be tracked by that same derived.
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- the slots are reactive; the lookup must not be.
const vestiges = new Map<string, { vestige: Vestige | null }>();

function slotOf(id: string): { vestige: Vestige | null } {
    let slot = vestiges.get(id);
    if (!slot) {
        const created = $state<{ vestige: Vestige | null }>({ vestige: null });
        vestiges.set(id, created);
        slot = created;
    }
    return slot;
}

export function prepareVestige(id: string): void {
    slotOf(id);
}

export function getVestige(id: string | null): Vestige | null {
    return id === null ? null : vestiges.get(id)?.vestige ?? null;
}

// Runs are immutable. Edits and undo replace the modification list. Cache JSON by identity
// so neither snapshots nor Electron's context bridge repeatedly walk their contents.
type SnapshotSource = Run | Vestige["modifications"];
const snapshots = new WeakMap<SnapshotSource, string>();

function snapshotJSON(value: SnapshotSource, source = value): string {
    let snapshot = snapshots.get(value);
    if (snapshot === undefined) {
        snapshot = JSON.stringify(source);
        snapshots.set(value, snapshot);
    }
    return snapshot;
}

function registerVestige(stored: Vestige, incoming: Vestige): void {
    for (let i = 0; i < incoming.runs.length; i++) snapshotJSON(stored.runs[i], incoming.runs[i]);
    snapshotJSON(stored.modifications, incoming.modifications);
    slotOf(stored.media.id).vestige = stored;
}

export function appendVestigeRun(vestige: Vestige, run: Run): void {
    const index = vestige.runs.push(run) - 1;
    snapshotJSON(vestige.runs[index], run);
}

export function setProject(value: Project | null): void {
    projectState.project = value;
    for (const slot of vestiges.values()) slot.vestige = null;
    if (value) projectState.project!.vestiges.forEach((vestige, i) => registerVestige(vestige, value.vestiges[i]));
}

export function insertVestige(index: number, vestige: Vestige): void {
    const list = projectState.project!.vestiges;
    list.splice(index, 0, vestige);
    registerVestige(list[index], vestige);
}

export function removeVestige(id: string): boolean {
    const list = projectState.project?.vestiges;
    const index = list?.findIndex(vestige => vestige.media.id === id) ?? -1;
    if (!list || index < 0) return false;
    list.splice(index, 1);
    slotOf(id).vestige = null;
    return true;
}

export function getMedia(id: string | null): Media | null {
    return getVestige(id)?.media ?? null;
}

export function createBusyState(operation: ProjectOperation): { id: string; operation: ProjectOperation } {
    const current = $state({ id: "", operation });
    return current;
}

export function snapshotProject(value: Project): ProjectSaveSnapshot {
    return {
        ...value, vestiges: value.vestiges.map(vestige => ({
            ...vestige, media: $state.snapshot(vestige.media), modifications: snapshotJSON(vestige.modifications),
            runs: vestige.runs.map(run => snapshotJSON(run))
        }))
    };
}