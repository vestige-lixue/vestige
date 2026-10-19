import { tick } from "svelte";
import { focus, type FocusTarget } from "../focus";
import * as project from "./project.svelte";
import * as mediaImport from "./mediaImport.svelte";
import * as dialogs from "./dialogs.svelte";
import * as transcription from "./transcription.svelte";
import * as transcript from "./transcript.svelte";
import * as player from "./player.svelte";
import * as mediaSelection from "./mediaSelection.svelte";
import * as settings from "./settings.svelte";

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
    dialogs.show({ kind: "transcription", mediaId, taskId, onClosed: () => { } });
}

function openTranscriptionTasks(focusTaskId?: string): void {
    dialogs.show({
        kind: "tasks", getTasks: transcription.getTasks, focusTaskId,
        onStop: transcription.stopTask, onRemove: transcription.remove,
        onRetry: taskId => {
            const task = transcription.getTaskById(taskId);
            if (task) openTranscriptionConfig(task.mediaId, task.id);
        },
        onClosed: () => { }
    });
}

function openPanel(panel: "transcription-backends" | "transcription-models" | "transcription-presets" | "vocabulary" | "tasks" | "settings" | "licenses" | "about" | "guide"): void {
    if (panel === "tasks") openTranscriptionTasks();
    else if (panel === "transcription-presets") dialogs.showTranscriptionPresets();
    else dialogs.show({ kind: panel, onClosed: () => { } });
}

export function wordPosition(direction: -1 | 1, fromWordIndex?: number): number | null {
    return transcript.getWordPosition(player.getCurrentTime(), direction, fromWordIndex);
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
        case "openTranscriptionConfig": openTranscriptionConfig(command.mediaId!); break;
        case "stopTranscription": transcription.stop(command.mediaId!); break;
        case "reviewTranscriptionError": openTranscriptionTasks(transcription.getTask(command.mediaId!)?.id); break;
        case "openTranscriptionTask": openTranscriptionTasks(transcription.getTask(command.mediaId!)?.id); break;
        case "selectMedia": project.selectMedia(command.mediaId); break;
        case "renameMedia": project.renameMedia(command.mediaId, command.name); break;
        case "removeMedia": project.removeMedia(command.mediaId); break;
        case "retryMediaImportError": project.retryMedia(command.mediaId); break;
        case "relocateMedia": project.relinkMedia(command.mediaId); break;
        case "ignoreMediaImportError": project.ignoreMedia(command.mediaId); break;
        case "reviewMediaImportError": project.reviewMedia(command.mediaId); break;
        case "playSelectedMedia": player.togglePlaying(); break;
        case "focus":
            // Closing menus must release focus before the target receives it.
            void tick().then(() => focus(command.target));
            break;
        case "setPlaybackSpeed": player.setSpeed(command.speed); break;
        case "savePlaybackSpeed": player.saveSpeed(); break;
        case "restorePlaybackSpeed": player.restoreSpeed(); break;
        case "setPlaybackVolume": player.setVolume(command.volume); break;
        case "toggleVolumeStabilization": player.toggleVolumeStabilization(); break;
        case "seekSelectedMedia": project.seekPlayback(command.time, command.mode); break;
        case "selectAdjacentMedia": project.selectMedia(mediaSelection.adjacent(command.direction, true)); break;
        case "seekAdjacentWord": {
            const time = wordPosition(command.direction, command.fromWordIndex);
            if (time !== null) {
                const playing = player.isPlaying();
                project.seekPlayback(time);
                player.setPlaying({ pause: false, play: true, keep: playing, invert: !playing }[settings.getPlayback().wordSwitchPlayback]);
            }
            break;
        }
        case "openDevTools": window.api.openDevTools(); break;
        case "openProjectRepository": window.open("https://github.com/vestige-lixue/vestige", "_blank"); break;
    }
}