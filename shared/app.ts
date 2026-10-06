import { type FilePathResult } from "./util/file";
import { type TranscriptionRequest, type TranscriptionResult } from "./transcription/executer";
import { type GetProjectResult, type SaveProjectResult } from "./project/file";
import { type Project } from "./project/Project";
import { type AbsolutePath } from "./util/path";
import { type MediaCheckResult, type MediaReference, type MediaURLResult } from "./media/check";
import { type ConfigPatch, type ConfigResult, type ConfigSnapshot, type PlaybackConfigPatch } from "./config/Config";

export type EditAction = "undo" | "redo" | "cut" | "copy" | "paste";

export type AppAPI = {
    platform: NodeJS.Platform;
    openDevTools(): void;
    quit(): void;
    edit(action: EditAction): void;
    // The renderer prompts/saves and returns true to block, false to allow quitting.
    beforeQuit(check: () => boolean | Promise<boolean>): () => void;
    config: {
        get(): Promise<ConfigSnapshot>;
        update(patch: ConfigPatch): Promise<ConfigResult>;
        setSidebarWidth(width: number): Promise<ConfigResult>;
        updatePlayback(patch: PlaybackConfigPatch): Promise<ConfigResult>;
        save(): Promise<ConfigResult>;
        onChanged(listener: (snapshot: ConfigSnapshot) => void): () => void;
    };
    file: {
        getPathForFile(file: File): Promise<FilePathResult>;
        readMedia(id: string, path: AbsolutePath, reference: MediaReference | null): Promise<MediaCheckResult>;
        cancelMediaRead(id: string): void;
        getMediaURL(path: AbsolutePath): Promise<MediaURLResult>;
        releaseMediaURL(id: string): Promise<void>;
        selectMediaPath(path: AbsolutePath | null): Promise<AbsolutePath | null>;
        selectMediaPaths(): Promise<AbsolutePath[]>;
    };
    transcription: {
        transcribe(id: string, request: TranscriptionRequest): Promise<TranscriptionResult>;
        cancel(id: string): void;
    };
    project: {
        getProject(path: AbsolutePath): Promise<GetProjectResult>;
        saveProject(path: AbsolutePath, project: Project): Promise<SaveProjectResult>;
        selectOpenPath(): Promise<AbsolutePath | null>;
        selectSavePath(path: AbsolutePath | null, saveAs: boolean): Promise<AbsolutePath | null>;
    };
};