import * as project from "./project.svelte";
import * as mediaImport from "./mediaImport.svelte";
import * as dialogs from "./dialogs.svelte";
import * as transcription from "./transcription.svelte";
import * as transcript from "./transcript.svelte";
import * as player from "./player.svelte";
import * as mediaSelection from "./mediaSelection.svelte";
import * as config from "./config.svelte";

type ParameterlessCommand = {
    kind: "newProject" | "saveProject" | "saveProjectAs" | "closeProject" | "quitApp" | "openDevTools" | "openProjectRepository" | "focusPlaybackSpeed" | "focusPlaybackVolume" | "savePlaybackSpeed" | "restorePlaybackSpeed" | "toggleVolumeStabilization";
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
    panel: "vocabulary" | "tasks" | "settings" | "licenses" | "about";
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
    mode?: player.SeekMode;
};

type SetPlaybackSpeedCommand = {
    kind: "setPlaybackSpeed";
    speed: number;
};

type SetPlaybackVolumeCommand = {
    kind: "setPlaybackVolume";
    volume: number;
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
    SeekSelectedMediaCommand |
    SetPlaybackSpeedCommand |
    SetPlaybackVolumeCommand
);

export function interfaceBlocked(): boolean {
    return project.projectState.locked || project.projectState.error !== null || project.saveConfirmation.pending
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

function openPanel(panel: "vocabulary" | "tasks" | "settings" | "licenses" | "about"): void {
    if (panel === "tasks") {
        dialogs.show({
            kind: "tasks", getTasks: transcription.getTasks,
            onStop: mediaId => transcription.stop(mediaId), onFailure: showTranscriptionFailure, onClosed: () => { }
        });
    }
    else dialogs.show({ kind: panel, onClosed: () => { } });
}

export function wordPosition(direction: -1 | 1): number | null {
    return transcript.getWordPosition(player.getCurrentTime(), direction);
}

export function commandDisabled(command: Command): boolean {
    switch (command.kind) {
        case "saveProject": return !mediaImport.hasPendingImports() && (!project.projectState.project || project.projectState.path !== null);
        case "saveProjectAs": case "closeProject": return !project.projectState.project && !mediaImport.hasPendingImports();
        case "openTranscriptionConfig": {
            const task = command.mediaId ? transcription.getTask(command.mediaId) : null;
            return !config.isReady() || !command.mediaId || !mediaImport.isReady(command.mediaId) || (task !== null && task.status !== "failed");
        }
        case "stopTranscription": {
            const status = command.mediaId ? transcription.getTask(command.mediaId)?.status : null;
            return status !== "running" && status !== "queued";
        }
        case "reviewTranscriptionError": return !command.mediaId || transcription.getTask(command.mediaId)?.status !== "failed";
        case "selectMedia": return !mediaImport.isReady(command.mediaId);
        case "playSelectedMedia": case "seekSelectedMedia": return !player.getURL();
        case "selectAdjacentMedia": return mediaSelection.adjacent(command.direction, true) === null;
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
        case "focusPlaybackSpeed": player.requestSpeedFocus(); break;
        case "focusPlaybackVolume": player.requestVolumeFocus(); break;
        case "setPlaybackSpeed": player.setSpeed(command.speed); break;
        case "savePlaybackSpeed": player.saveSpeed(); break;
        case "restorePlaybackSpeed": player.restoreSpeed(); break;
        case "setPlaybackVolume": player.setVolume(command.volume); break;
        case "toggleVolumeStabilization": player.toggleVolumeStabilization(); break;
        case "seekSelectedMedia": project.seekPlayback(command.time, command.mode); break;
        case "selectAdjacentMedia": project.selectMedia(mediaSelection.adjacent(command.direction, true)); break;
        case "seekAdjacentWord": {
            const time = wordPosition(command.direction);
            if (time !== null) project.seekPlayback(time);
            break;
        }
        case "openDevTools": window.api.openDevTools(); break;
        case "openProjectRepository": window.open("https://github.com/vestige-lixue/vestige", "_blank"); break;
    }
}