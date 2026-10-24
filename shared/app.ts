import { type FilePathResult } from "./util/file";
import { type TranscriptionRequest, type TranscriptionResult } from "./transcription/executer";
import { type GetProjectResult, type SaveProjectResult } from "./project/file";
import { type Project } from "./project/Project";
import { type AbsolutePath } from "./util/path";
import { type MediaCheckResult, type MediaReference, type MediaURLResult } from "./media/check";
import { type SettingsPatch, type SettingsResult, type SettingsSnapshot } from "./settings/Settings";
import { type TaskSnapshot } from "./task";
import { type Documentation, type DocumentationKind } from "./documentation";
import { type Download, type DownloadKind } from "./downloads";

export type EditAction = "selectAll" | "undo" | "redo" | "cut" | "copy" | "paste";

export type AppAPI = {
    platform: NodeJS.Platform;
    ready(): void;
    openDevTools(): void;
    supportsMica(): Promise<boolean>;
    quit(): void;
    edit(action: EditAction): void;
    clearLogs(): Promise<void>;
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
        listDirectories(kind: DownloadKind): Promise<string[]>;
        openFFmpegDirectory(): Promise<void>;
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
        list(): Promise<Download[]>;
        start(kind: DownloadKind, id: string): Promise<string>;
        cancel(taskId: string): Promise<void>;
        openDirectory(kind: DownloadKind): Promise<void>;
    };
    documentation: {
        read(kind: DocumentationKind, language: string): Promise<Documentation>;
        readLink(from: string, href: string): Promise<Documentation>;
        openExternal(url: string): Promise<void>;
    };
    project: {
        getProject(path: AbsolutePath): Promise<GetProjectResult>;
        saveProject(path: AbsolutePath, project: Project): Promise<SaveProjectResult>;
        selectOpenPath(): Promise<AbsolutePath | null>;
        selectSavePath(path: AbsolutePath | null, saveAs: boolean): Promise<AbsolutePath | null>;
    };
};