import { type FailureInfo } from "../../shared/failure";
import { type MediaIssueStatus } from "../../shared/media/check";
import { type AbsolutePath } from "../../shared/util/path";
import * as mediaImport from "./mediaImport.svelte";
import * as transcription from "./transcription.svelte";
import { type Config } from "../../shared/transcription/Config";

export type SaveChoice = "save" | "discard" | "cancel" | "memory" | "retry";

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

export type MediaRefImportIssue = {
    status: MediaIssueStatus;
    mediaId: string;
    path: AbsolutePath;
    error: FailureInfo;
};

type PanelDialog = {
    kind: "transcription-backends" | "transcription-models" | "vocabulary" | "settings" | "licenses" | "about" | "guide" | "parameter-guide";
};

type TranscriptionTasksDialog = {
    kind: "tasks";
    getTasks: () => transcription.TranscriptionTask[];
    focusTaskId?: string;
    onStop: (taskId: string) => void;
    onRetry: (taskId: string) => void;
    onRemove: (taskId: string) => void;
};

type TranscriptionConfigDialog = {
    kind: "transcription";
    mediaId: string;
    taskId?: string;
};

type SwitchDisplayedRunDialog = {
    kind: "switch-displayed-run";
    mediaId: string;
    onConfirm: () => void;
};

type TranscriptionPresetsDialog = {
    kind: "transcription-presets";
    selectedName?: string;
    onApply?: (name: string, config: Config) => void;
};

type SaveConfirmationDialog = {
    kind: "save-confirmation";
    fileName: string | null;
    answer: (choice: SaveChoice) => void;
};

type SaveFailureDialog = {
    kind: "save-failure";
    fileName: string | null;
    error: FailureInfo;
    answer: (choice: SaveChoice) => void;
};

type ProjectBusyDialog = {
    kind: "project-busy";
    getOperation: () => ProjectOperation;
};

type ProjectErrorDialog = {
    kind: "project-error";
    error: ProjectError;
};

type MediaImportErrorDialog = {
    kind: "media-import-error";
    failure: mediaImport.MediaImportFailure;
};

type MediaRefImportErrorDialog = {
    kind: "media-ref-import-error";
    issue: MediaRefImportIssue;
    onRetry: () => void;
    onRelink: () => void;
    onIgnore: () => void;
};

export type DialogDescriptor = (
    PanelDialog |
    TranscriptionTasksDialog |
    TranscriptionConfigDialog |
    SwitchDisplayedRunDialog |
    TranscriptionPresetsDialog |
    SaveConfirmationDialog |
    SaveFailureDialog |
    ProjectBusyDialog |
    ProjectErrorDialog |
    MediaImportErrorDialog |
    MediaRefImportErrorDialog
) & {
    onClosed: () => void;
    parentId?: string;
};

export type ApplicationDialog = DialogDescriptor & {
    id: string;
    open: boolean;
};

export const state = $state<{ dialogs: ApplicationDialog[] }>({
    dialogs: []
});

export function show(descriptor: DialogDescriptor): string {
    const id = crypto.randomUUID();
    state.dialogs.push(Object.assign(descriptor, { id, open: true }));
    return id;
}

export function close(id: string): void {
    const dialog = state.dialogs.find(dialog => dialog.id === id);
    if (dialog) dialog.open = false;
}

export function remove(id: string): void {
    // Cascade only after the parent accepted closing; a form may reject the request.
    for (const child of state.dialogs.filter(dialog => dialog.parentId === id)) {
        remove(child.id);
        child.onClosed();
    }
    const index = state.dialogs.findIndex(dialog => dialog.id === id);
    if (index >= 0) state.dialogs.splice(index, 1);
}

export function showTranscriptionPresets(parentId?: string, onApply?: (name: string, config: Config) => void, selectedName?: string): string {
    const existing = state.dialogs.find(dialog => dialog.kind === "transcription-presets");
    if (existing) return existing.id;
    return show({ kind: "transcription-presets", parentId, onApply, selectedName, onClosed: () => {} });
}