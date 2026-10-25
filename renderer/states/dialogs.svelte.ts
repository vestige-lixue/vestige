import { type FailureInfo } from "../../shared/failure";
import { type MediaIssueStatus } from "../../shared/media/check";
import { type AbsolutePath } from "../../shared/util/path";
import * as mediaImport from "./mediaImport.svelte";
import * as transcription from "./transcription.svelte";
import { type Config } from "../../shared/transcription/Config";
import * as project from "./project.svelte";

export type SaveChoice = "save" | "discard" | "cancel" | "memory" | "retry";
export type SettingsSaveChoice = "retry" | "cancel" | "discard";

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

type SettingsSaveFailureDialog = {
    kind: "settings-save-failure";
    purpose: "close" | "quit";
    error: FailureInfo;
    answer: (choice: SettingsSaveChoice) => void;
};

type ProjectBusyDialog = {
    kind: "project-busy";
    getOperation: () => project.ProjectOperation;
};

type ProjectErrorDialog = {
    kind: "project-error";
    error: project.ProjectError;
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
    SettingsSaveFailureDialog |
    ProjectBusyDialog |
    ProjectErrorDialog |
    MediaImportErrorDialog |
    MediaRefImportErrorDialog
) & {
    onClosed?: () => void;
    parentId?: string;
};

export type ApplicationDialog = DialogDescriptor & {
    id: string;
    open: boolean;
};

export const state = $state<{ dialogs: ApplicationDialog[] }>({
    dialogs: []
});