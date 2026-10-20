import { tick } from "svelte";
import { focus, type FocusTarget } from "../focus";
import * as project from "./project.svelte";
import * as mediaImport from "./mediaImport.svelte";
import * as dialogs from "./dialogs.svelte";
import * as transcription from "./transcription.svelte";
import * as player from "./player.svelte";
import * as mediaSelection from "./mediaSelection.svelte";
import * as settings from "./settings.svelte";
import * as dialogsAPI from "./dialogs";
import * as transcriptionAPI from "./transcription";
import * as transcriptAPI from "./transcript";
import * as projectAPI from "./project";
import * as playerAPI from "./player";

type ParameterlessCommand = {
    kind: "newProject" | "saveProject" | "saveProjectAs" | "closeProject" | "quitApp" | "openDevTools" | "openProjectRepository" | "savePlaybackSpeed" | "restorePlaybackSpeed" | "toggleVolumeStabilization";
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

type FocusCommand = {
    kind: "focus";
    target: FocusTarget;
};

type OpenPanelCommand = {
    kind: "openPanel";
    panel: "transcription-backends" | "transcription-models" | "transcription-presets" | "vocabulary" | "tasks" | "settings" | "licenses" | "about" | "guide";
};

type TranscriptionCommand = {
    kind: "openTranscriptionConfig" | "openTranscriptionTask" | "stopTranscription" | "reviewTranscriptionError";
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

type MoveMediaCommand = {
    kind: "moveMedia";
    mediaId: string;
    beforeId: string | null;
};

type AdjacentCommand = ({
    kind: "selectAdjacentMedia";
    direction: -1 | 1;
} | {
    kind: "seekAdjacentWord";
    direction: -1 | 1;
    fromWordIndex?: number;
});

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
    FocusCommand |
    OpenPanelCommand |
    TranscriptionCommand |
    MediaCommand |
    RelocateMediaCommand |
    RenameMediaCommand |
    MoveMediaCommand |
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

function openTranscriptionConfig(mediaId: string, taskId?: string): void {
    if (!mediaImport.isReady(mediaId) || transcription.isPending(transcription.getTask(mediaId))) return;
    dialogsAPI.show({ kind: "transcription", mediaId, taskId, onClosed: () => { } });
}

function openTranscriptionTasks(focusTaskId?: string): void {
    dialogsAPI.show({
        kind: "tasks", getTasks: transcription.getTasks, focusTaskId,
        onStop: transcriptionAPI.stopTask, onRemove: transcriptionAPI.remove,
        onRetry: taskId => {
            const task = transcription.getTaskById(taskId);
            if (task) openTranscriptionConfig(task.mediaId, task.id);
        },
        onClosed: () => { }
    });
}

function openPanel(panel: "transcription-backends" | "transcription-models" | "transcription-presets" | "vocabulary" | "tasks" | "settings" | "licenses" | "about" | "guide"): void {
    if (panel === "tasks") openTranscriptionTasks();
    else if (panel === "transcription-presets") dialogsAPI.showTranscriptionPresets();
    else dialogsAPI.show({ kind: panel, onClosed: () => { } });
}

export function wordPosition(direction: -1 | 1, fromWordIndex?: number): number | null {
    return transcriptAPI.getWordPosition(player.getCurrentTime(), direction, fromWordIndex);
}

export function commandDisabled(command: Command): boolean {
    switch (command.kind) {
        case "saveProject": return !mediaImport.hasPendingImports() && (!project.projectState.project || project.projectState.path !== null);
        case "saveProjectAs": case "closeProject": return !project.projectState.project && !mediaImport.hasPendingImports();
        case "openTranscriptionConfig": {
            const task = command.mediaId ? transcription.getTask(command.mediaId) : null;
            return !settings.isReady() || !command.mediaId || !mediaImport.isReady(command.mediaId) || transcription.isPending(task);
        }
        case "stopTranscription": {
            const status = command.mediaId ? transcription.getTask(command.mediaId)?.status : null;
            return status !== "running" && status !== "queued";
        }
        case "reviewTranscriptionError": return !command.mediaId || transcription.getTask(command.mediaId)?.status !== "failed";
        case "openTranscriptionTask": return !command.mediaId || !transcription.getTask(command.mediaId);
        case "selectMedia": return !mediaImport.isReady(command.mediaId);
        case "playSelectedMedia": case "seekSelectedMedia": return !player.getURL();
        case "selectAdjacentMedia": return mediaSelection.adjacent(command.direction, true) === null;
        case "seekAdjacentWord": return !player.getURL() || wordPosition(command.direction, command.fromWordIndex) === null;
        default: return false;
    }
}

export function runCommand(command: Command): void {
    if (interfaceBlocked() || commandDisabled(command)) return;
    switch (command.kind) {
        case "newProject": void projectAPI.create(); break;
        case "openProject": void projectAPI.open(); break;
        case "saveProject": void projectAPI.save(); break;
        case "saveProjectAs": void projectAPI.save(true); break;
        case "closeProject": void projectAPI.close(); break;
        case "quitApp": void projectAPI.close().then(closed => {
            if (closed) window.api.quit();
        }); break;
        case "importMedia": void projectAPI.selectMediaForImport(); break;
        case "openPanel": openPanel(command.panel); break;
        case "openTranscriptionConfig": openTranscriptionConfig(command.mediaId!); break;
        case "stopTranscription": transcriptionAPI.stop(command.mediaId!); break;
        case "reviewTranscriptionError": openTranscriptionTasks(transcription.getTask(command.mediaId!)?.id); break;
        case "openTranscriptionTask": openTranscriptionTasks(transcription.getTask(command.mediaId!)?.id); break;
        case "selectMedia": projectAPI.selectMedia(command.mediaId); break;
        case "renameMedia": projectAPI.renameMedia(command.mediaId, command.name); break;
        case "moveMedia": projectAPI.moveMedia(command.mediaId, command.beforeId); break;
        case "removeMedia": projectAPI.removeMedia(command.mediaId); break;
        case "retryMediaImportError": projectAPI.retryMedia(command.mediaId); break;
        case "relocateMedia": projectAPI.relinkMedia(command.mediaId); break;
        case "ignoreMediaImportError": projectAPI.ignoreMedia(command.mediaId); break;
        case "reviewMediaImportError": projectAPI.reviewMedia(command.mediaId); break;
        case "playSelectedMedia": playerAPI.togglePlaying(); break;
        case "focus":
            // Closing menus must release focus before the target receives it.
            void tick().then(() => focus(command.target));
            break;
        case "setPlaybackSpeed": playerAPI.setSpeed(command.speed); break;
        case "savePlaybackSpeed": playerAPI.saveSpeed(); break;
        case "restorePlaybackSpeed": playerAPI.restoreSpeed(); break;
        case "setPlaybackVolume": playerAPI.setVolume(command.volume); break;
        case "toggleVolumeStabilization": playerAPI.toggleVolumeStabilization(); break;
        case "seekSelectedMedia": projectAPI.seekPlayback(command.time, command.mode); break;
        case "selectAdjacentMedia": projectAPI.selectMedia(mediaSelection.adjacent(command.direction, true)); break;
        case "seekAdjacentWord": {
            const time = wordPosition(command.direction, command.fromWordIndex);
            if (time !== null) {
                const playing = player.isPlaying();
                projectAPI.seekPlayback(time);
                playerAPI.setPlaying({ pause: false, play: true, keep: playing, invert: !playing }[settings.getPlayback().wordSwitchPlayback]);
            }
            break;
        }
        case "openDevTools": window.api.openDevTools(); break;
        case "openProjectRepository": window.open("https://github.com/vestige-lixue/vestige", "_blank"); break;
    }
}