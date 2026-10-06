import { type Failure } from "../../shared/failure";
import { type MediaIssueStatus } from "../../shared/media/check";
import { type AbsolutePath } from "../../shared/util/path";
import * as mediaImport from "./mediaImport.svelte";
import * as transcription from "./transcription.svelte";

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
    failure: Failure;
} | {
    kind: "read-failed";
    path: AbsolutePath;
    failure: Failure;
});

export type MediaRefImportIssue = {
    status: MediaIssueStatus;
    mediaId: string;
    path: AbsolutePath;
    error: Failure;
};

type PanelDialog = {
    kind: "vocabulary" | "settings" | "licenses" | "about";
};

type TranscriptionTasksDialog = {
    kind: "tasks";
    getTasks: () => transcription.TranscriptionTask[];
    onStop: (mediaId: string) => void;
    onFailure: (mediaId: string) => void;
};

type TranscriptionConfigDialog = {
    kind: "transcription";
    mediaId: string;
};

type TranscriptionFailureDialog = {
    kind: "failure";
    mediaId: string;
    error: Failure;
    onConfigure: () => void;
};

type SaveConfirmationDialog = {
    kind: "save-confirmation";
    fileName: string | null;
    answer: (choice: SaveChoice) => void;
};

type SaveFailureDialog = {
    kind: "save-failure";
    fileName: string | null;
    error: Failure;
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
    TranscriptionFailureDialog |
    SaveConfirmationDialog |
    SaveFailureDialog |
    ProjectBusyDialog |
    ProjectErrorDialog |
    MediaImportErrorDialog |
    MediaRefImportErrorDialog
) & {
    onClosed: () => void;
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
    const index = state.dialogs.findIndex(dialog => dialog.id === id);
    if (index >= 0) state.dialogs.splice(index, 1);
}