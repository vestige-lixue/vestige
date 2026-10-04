import * as project from "./project.svelte";
import * as mediaImport from "./mediaImport.svelte";
import * as dialogs from "./dialogs.svelte";
import * as transcription from "./transcription.svelte";
import * as player from "./player.svelte";
import * as mediaSelection from "./mediaSelection.svelte";

type ParameterlessCommand = {
    kind: "newProject" | "saveProject" | "saveProjectAs" | "closeProject" | "quitApp" | "openDevTools";
};

// Select a project file, read it, and handle saving the current project before switching.
type OpenProjectCommand = {
    kind: "openProject";
};

// Select media files and submit the selected paths to the media import queue.
type ImportMediaCommand = {
    kind: "importMedia";
};

// Toggle playback of the selected media between playing and paused.
type PlaySelectedMediaCommand = {
    kind: "playSelectedMedia";
};

type OpenPanelCommand = {
    kind: "openPanel";
    panel: "vocabulary" | "tasks" | "settings";
};

type TranscriptionCommand = {
    kind: "openTranscriptionConfig" | "stopTranscription" | "reviewTranscriptionError";
    mediaId: string | null;
};

type MediaCommand = {
    kind: "selectMedia" | "removeMedia" | "retryMediaImportError" | "ignoreMediaImportError" | "reviewMediaImportError";
    mediaId: string;
};

// Select the original media's new location, verify its contents, and update its reference.
// Cancellation or failed verification preserves the original reference and transcripts.
type RelocateMediaCommand = {
    kind: "relocateMedia";
    mediaId: string;
};

type RenameMediaCommand = {
    kind: "renameMedia";
    mediaId: string;
    name: string;
};

type AdjacentCommand = {
    kind: "selectAdjacentMedia" | "seekAdjacentWord";
    direction: -1 | 1;
};

type SeekSelectedMediaCommand = {
    kind: "seekSelectedMedia";
    time: number;
};

export type Command = (
    ParameterlessCommand |
    OpenProjectCommand |
    ImportMediaCommand |
    PlaySelectedMediaCommand |
    OpenPanelCommand |
    TranscriptionCommand |
    MediaCommand |
    RelocateMediaCommand |
    RenameMediaCommand |
    AdjacentCommand |
    SeekSelectedMediaCommand
);

export function interfaceBlocked(): boolean {
    return project.projectState.locked || project.projectState.error !== null || project.saveConfirmation.fileName !== null
        || dialogs.state.dialogs.length > 0 || mediaImport.isPicking() || mediaImport.isCollecting()
        || mediaImport.getIssue() !== null || mediaImport.getImportFailures().length > 0 || mediaImport.isRelocating();
}

function configureTranscription(mediaId: string): void {
    if (!mediaImport.isReady(mediaId)) return;
    dialogs.show({ kind: "transcription", mediaId, onClosed: () => { } });
}

function showTranscriptionFailure(mediaId: string): void {
    const task = transcription.getTask(mediaId);
    if (task?.status !== "failed") return;
    dialogs.show({ kind: "failure", mediaId, error: task.error, onConfigure: () => configureTranscription(mediaId), onClosed: () => { } });
}

function openPanel(panel: "vocabulary" | "tasks" | "settings"): void {
    if (panel === "tasks") {
        dialogs.show({
            kind: "tasks", getTasks: transcription.getTasks,
            onStop: mediaId => transcription.stop(mediaId), onFailure: showTranscriptionFailure, onClosed: () => { }
        });
    }
    else dialogs.show({ kind: panel, onClosed: () => { } });
}

export function wordPosition(direction: -1 | 1): number | null {
    const vestige = project.getVestige(mediaSelection.get());
    const segments = vestige?.runs[vestige.primaryRunIdx]?.transcript ?? [];
    const starts = segments.filter(segment => segment.token.text.trim()).map(segment => segment.range.start).sort((a, b) => a - b);
    return direction === 1 ? starts.find(time => time > player.getCurrentTime() + 0.001) ?? null
        : starts.findLast(time => time < player.getCurrentTime() - 0.001) ?? null;
}

export function commandDisabled(command: Command): boolean {
    switch (command.kind) {
        case "saveProject": return !mediaImport.hasPendingImports() && (!project.projectState.project || project.projectState.path !== null);
        case "saveProjectAs": case "closeProject": return !project.projectState.project && !mediaImport.hasPendingImports();
        case "openTranscriptionConfig": {
            const task = command.mediaId ? transcription.getTask(command.mediaId) : null;
            return !command.mediaId || !mediaImport.isReady(command.mediaId) || (task !== null && task.status !== "failed");
        }
        case "stopTranscription": return !command.mediaId || transcription.getTask(command.mediaId)?.status !== "running";
        case "reviewTranscriptionError": return !command.mediaId || transcription.getTask(command.mediaId)?.status !== "failed";
        case "selectMedia": return !mediaImport.isReady(command.mediaId);
        case "playSelectedMedia": case "seekSelectedMedia": return !player.getURL();
        case "selectAdjacentMedia": return mediaSelection.adjacent(command.direction) === null;
        case "seekAdjacentWord": return !player.getURL() || wordPosition(command.direction) === null;
        default: return false;
    }
}

export function runCommand(command: Command): void {
    if (interfaceBlocked() || commandDisabled(command)) return;
    switch (command.kind) {
        case "newProject": void project.create(); break;
        case "openProject": void project.open(); break;
        case "saveProject": void project.save(); break;
        case "saveProjectAs": void project.save(true); break;
        case "closeProject": void project.close(); break;
        case "quitApp": void project.close().then(closed => {
            if (closed) window.api.quit();
        }); break;
        case "importMedia": void project.selectMediaForImport(); break;
        case "openPanel": openPanel(command.panel); break;
        case "openTranscriptionConfig": configureTranscription(command.mediaId!); break;
        case "stopTranscription": transcription.stop(command.mediaId!); break;
        case "reviewTranscriptionError": showTranscriptionFailure(command.mediaId!); break;
        case "selectMedia": project.selectMedia(command.mediaId); break;
        case "renameMedia": project.renameMedia(command.mediaId, command.name); break;
        case "removeMedia": project.removeMedia(command.mediaId); break;
        case "retryMediaImportError": project.retryMedia(command.mediaId); break;
        case "relocateMedia": project.relinkMedia(command.mediaId); break;
        case "ignoreMediaImportError": project.ignoreMedia(command.mediaId); break;
        case "reviewMediaImportError": project.reviewMedia(command.mediaId); break;
        case "playSelectedMedia": player.togglePlaying(); break;
        case "seekSelectedMedia": project.seekPlayback(command.time); break;
        case "selectAdjacentMedia": project.selectMedia(mediaSelection.adjacent(command.direction)); break;
        case "seekAdjacentWord": {
            const time = wordPosition(command.direction);
            if (time !== null) project.seekPlayback(time);
            break;
        }
        case "openDevTools": window.api.openDevTools(); break;
    }
}