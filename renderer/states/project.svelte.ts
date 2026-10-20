import { type FailureInfo } from "../../shared/failure";
import { type Project } from "../../shared/project/Project";
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
    kind: "pending-imports" | "active-transcriptions";
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

export function getVestige(id: string | null): Vestige | null {
    return projectState.project?.vestiges.find(vestige => vestige.media.id === id) ?? null;
}

export function getMedia(id: string | null): Media | null {
    return getVestige(id)?.media ?? null;
}

export function createBusyState(operation: ProjectOperation): { id: string; operation: ProjectOperation } {
    const current = $state({ id: "", operation });
    return current;
}

export function snapshotProject(value: Project): Project {
    return $state.snapshot(value);
}