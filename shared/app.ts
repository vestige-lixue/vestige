import { type DirectoryListResult, type FilePathResult } from "./util/file";
import { type TranscriptionRequest, type TranscriptionResult } from "./transcription/executor";
import { type GetProjectResult, type SaveProjectResult, type CheckProjectFileResult } from "./project/file";
import { type Project } from "./project/Project";
import { type AbsolutePath } from "./util/path";
import { type MediaCheckResult, type MediaReference, type MediaURLResult } from "./media/check";
import { type SettingsPatch, type SettingsResult, type SettingsSnapshot } from "./settings/Settings";
import { type TaskSnapshot } from "./task";
import { type DocumentationResult, type DocumentationKind } from "./documentation";
import { type DownloadListResult, type DownloadStartResult, type DownloadKind } from "./downloads";
import { type OperationResult } from "./failure";

export type EditAction = "selectAll" | "undo" | "redo" | "cut" | "copy" | "paste";

export type AppAPI = {
    platform: NodeJS.Platform;
    ready(): void;
    openDevTools(): void;
    supportsMica(): Promise<boolean>;
    quit(): void;
    edit(action: EditAction): void;
    clearLogs(): Promise<OperationResult>;
    // The renderer prompts/saves and returns true to block, false to allow quitting.
    beforeQuit(check: () => boolean | Promise<boolean>): () => void;
    settings: {
        get(): Promise<SettingsSnapshot>;
        update(patch: SettingsPatch): Promise<SettingsResult>;
        save(): Promise<SettingsResult>;
        onChanged(listener: (snapshot: SettingsSnapshot) => void): () => void;
    };
    file: {
        getPathForFile(file: File): Promise<FilePathResult>;
        readMedia(id: string, path: AbsolutePath, reference: MediaReference | null): Promise<MediaCheckResult>;
        cancelMediaRead(id: string): void;
        getMediaURL(path: AbsolutePath): Promise<MediaURLResult>;
        releaseMediaURL(id: string): Promise<void>;
        selectMediaPath(path: AbsolutePath | null): Promise<AbsolutePath | null>;
        selectMediaPaths(): Promise<AbsolutePath[]>;
        selectDirectory(kind: DownloadKind): Promise<AbsolutePath | null>;
        listDirectories(kind: DownloadKind): Promise<DirectoryListResult>;
        openFFmpegDirectory(): Promise<OperationResult>;
    };
    transcription: {
        transcribe(id: string, request: TranscriptionRequest): Promise<TranscriptionResult>;
        cancel(id: string): void;
    };
    taskOutput: {
        get(id: string): Promise<TaskSnapshot | null>;
        subscribe(id: string, listener: (snapshot: TaskSnapshot) => void): () => void;
    };
    downloads: {
        list(): Promise<DownloadListResult>;
        start(kind: DownloadKind, id: string): Promise<DownloadStartResult>;
        cancel(taskId: string): Promise<OperationResult>;
        openDirectory(kind: DownloadKind): Promise<OperationResult>;
    };
    documentation: {
        read(kind: DocumentationKind, language: string): Promise<DocumentationResult>;
        readLink(from: string, href: string): Promise<DocumentationResult>;
        openExternal(url: string): Promise<OperationResult>;
    };
    project: {
        getProject(path: AbsolutePath): Promise<GetProjectResult>;
        checkProjectFile(path: AbsolutePath): Promise<CheckProjectFileResult>;
        saveProject(path: AbsolutePath, project: Project): Promise<SaveProjectResult>;
        selectOpenPath(): Promise<AbsolutePath | null>;
        selectSavePath(path: AbsolutePath | null, saveAs: boolean): Promise<AbsolutePath | null>;
    };
};