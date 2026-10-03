import { type TranscriptionRequest } from "./transcription/executer";
import { type GetProjectResult, type SaveProjectResult } from "./project/file";
import { type Project } from "./project/Project";
import { type Run } from "./transcription/Run";
import { type AbsolutePath } from "./util/path";
import { type MediaCheckResult, type MediaReference, type MediaSourceHandle } from "./media/check";

export type EditAction = "undo" | "redo" | "cut" | "copy" | "paste";

export type AppAPI = {
    platform: NodeJS.Platform;
    openDevTools(): void;
    quit(): void;
    edit(action: EditAction): void;
    // The renderer prompts/saves and returns true to block, false to allow quitting.
    beforeQuit(check: () => boolean | Promise<boolean>): () => void;
    file: {
        getPathForFile(file: File): Promise<AbsolutePath>;
        readMedia(id: string, path: AbsolutePath, reference: MediaReference | null): Promise<MediaCheckResult>;
        cancelMediaRead(id: string): void;
        openMediaSource(path: AbsolutePath): Promise<MediaSourceHandle>;
        closeMediaSource(id: string): void;
        selectMediaPath(path: AbsolutePath | null): Promise<AbsolutePath | null>;
        selectMediaPaths(): Promise<AbsolutePath[]>;
    };
    transcription: {
        transcribe(id: string, request: TranscriptionRequest): Promise<Run>;
        cancel(id: string): void;
    };
    project: {
        getProject(path: AbsolutePath): Promise<GetProjectResult>;
        saveProject(path: AbsolutePath, project: Project): Promise<SaveProjectResult>;
        selectOpenPath(): Promise<AbsolutePath | null>;
        selectSavePath(path: AbsolutePath | null): Promise<AbsolutePath | null>;
    };
};