import { type TranscriptionRequest } from "./transcription/executer";
import { type GetProjectResult, type SaveProjectResult } from "./project/file";
import { type Project } from "./project/Project";
import { type Run } from "./transcription/Run";

export type AppAPI = {
    platform: NodeJS.Platform;
    openDevTools(): void;
    // The renderer prompts/saves and returns true to block, false to allow quitting.
    beforeQuit(check: () => boolean | Promise<boolean>): () => void;
    file: {
        getPathForFile(file: File): string;
    };
    transcription: {
        transcribe(request: TranscriptionRequest): Promise<Run>;
    };
    project: {
        getProject(path: string): Promise<GetProjectResult>;
        saveProject(path: string, project: Project): Promise<SaveProjectResult>;
        selectOpenPath(): Promise<string | null>;
        selectSavePath(path: string | null): Promise<string | null>;
    };
};