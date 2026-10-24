import { tick } from "svelte";
import { type ParseKeys } from "i18next";
import * as i18n from "../i18n.svelte";
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
    kind: "newProject" | "saveProject" | "saveProjectAs" | "closeProject" | "quitApp" | "openDevTools" | "openProjectRepository" | "savePlaybackSpeed" | "restorePlaybackSpeed" | "toggleVolumeStabilization" | "cyclePlaybackMode";
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
    kind: "selectAdjacentMedia" | "moveSelectedMedia";
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

type SeekWordCommand = {
    kind: "seekWord";
    time: number;
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
    SeekWordCommand |
    SetPlaybackSpeedCommand |
    SetPlaybackVolumeCommand
);

export function interfaceBlocked(): boolean {
    return project.projectState.locked || project.projectState.error !== null || project.saveConfirmation.pending
        || dialogs.state.dialogs.length > 0 || mediaImport.isPicking() || mediaImport.isCollecting()
        || mediaImport.getIssue() !== null || mediaImport.getImportFailures().length > 0 || mediaImport.isRelocating();
}

function openTranscriptionConfig(mediaId: string): void {
    if (!mediaImport.isReady(mediaId) || transcription.isPending(transcription.getTask(mediaId))) return;
    dialogsAPI.show({ kind: "transcription", mediaId });
}

function openTranscriptionTasks(focusTaskId?: string): void {
    dialogsAPI.show({
        kind: "tasks", getTasks: transcription.getTasks, focusTaskId,
        onStop: transcriptionAPI.stopTask, onRemove: transcriptionAPI.remove,
        onRetry: taskId => {
            const task = transcription.getTaskById(taskId);
            if (task) openTranscriptionConfig(task.mediaId);
        }
    });
}

function openPanel(panel: "transcription-backends" | "transcription-models" | "transcription-presets" | "vocabulary" | "tasks" | "settings" | "licenses" | "about" | "guide"): void {
    if (panel === "tasks") openTranscriptionTasks();
    else if (panel === "transcription-presets") dialogsAPI.showTranscriptionPresets();
    else dialogsAPI.show({ kind: panel });
}

export function wordPosition(direction: -1 | 1, fromWordIndex?: number): number | null {
    return transcriptAPI.getWordPosition(player.getCurrentTime(), direction, fromWordIndex);
}

function adjacentMediaMove(direction: -1 | 1): MoveMediaCommand | null {
    const mediaId = mediaSelection.get();
    if (mediaId === null) return null;
    const ids = mediaImport.getIds();
    const index = ids.indexOf(mediaId);
    if (index < 0 || ids[index + direction] === undefined) return null;
    const beforeId = direction === -1 ? ids[index - 1] : ids[index + 2] ?? null;
    return { kind: "moveMedia", mediaId, beforeId };
}

type CommandOf<Kind extends Command["kind"]> = Command & { kind: Kind };
type CommandDefinition<Kind extends Command["kind"]> = {
    run: (command: CommandOf<Kind>) => void;
    enabled: (command: CommandOf<Kind>) => boolean;
    label: (command: CommandOf<Kind>) => string;
};

const always = (): boolean => true;
const hasProject = (): boolean => !!project.projectState.project || mediaImport.hasPendingImports();
const hasPlayback = (): boolean => !!player.getURL();
const label = (key: ParseKeys): (() => string) => () => i18n.t(key);
const panelLabels = {
    "transcription-backends": "transcription.backends.actions.manage",
    "transcription-models": "transcription.models.actions.manage",
    "transcription-presets": "transcription.presets.actions.manage",
    vocabulary: "transcription.vocabulary.title", tasks: "transcription.tasks.title", settings: "settings.title",
    licenses: "licenses.title", about: "menu.other.about", guide: "guide.title"
} satisfies Record<OpenPanelCommand["panel"], ParseKeys>;

function seekWord(time: number | null): void {
    if (time === null) return;
    const playing = player.isPlaying();
    // Pausing captures the current transport position before the new seek is requested.
    playerAPI.setPlaying({ pause: false, play: true, keep: playing, invert: !playing }[settings.getPlayback().wordSwitchPlayback]);
    projectAPI.seekPlayback(time);
}

const definitions: { [Kind in Command["kind"]]: CommandDefinition<Kind> } = {
    newProject: { run: () => void projectAPI.create(), enabled: always, label: label("menu.project.new") },
    openProject: { run: () => void projectAPI.open(), enabled: always, label: label("menu.project.open") },
    saveProject: {
        run: () => void projectAPI.save(),
        enabled: () => mediaImport.hasPendingImports() || !!project.projectState.project && project.projectState.path === null,
        label: label("common.save")
    },
    saveProjectAs: { run: () => void projectAPI.save(true), enabled: hasProject, label: label("menu.project.saveAs") },
    closeProject: { run: () => void projectAPI.close(), enabled: hasProject, label: label("common.close") },
    quitApp: {
        run: () => window.api.quit(),
        enabled: always, label: label("menu.other.quit")
    },
    importMedia: { run: () => void projectAPI.selectMediaForImport(), enabled: always, label: label("menu.media.import") },
    openPanel: { run: command => openPanel(command.panel), enabled: always, label: command => i18n.t(panelLabels[command.panel]) },
    openTranscriptionConfig: {
        run: command => openTranscriptionConfig(command.mediaId!),
        enabled: command => settings.isReady() && !!command.mediaId && mediaImport.isReady(command.mediaId)
            && !transcription.isPending(transcription.getTask(command.mediaId)),
        label: label("transcription.actions.new")
    },
    stopTranscription: {
        run: command => transcriptionAPI.stop(command.mediaId!),
        enabled: command => {
            const status = command.mediaId ? transcription.getTask(command.mediaId)?.status : null;
            return status === "running" || status === "queued";
        },
        label: command => {
            const status = command.mediaId ? transcription.getTask(command.mediaId)?.status : null;
            return i18n.t(status === "queued" ? "transcription.actions.cancelQueued"
                : status === "stopping" ? "transcription.tasks.status.stopping" : "transcription.actions.stop");
        }
    },
    reviewTranscriptionError: {
        run: command => openTranscriptionTasks(transcription.getTask(command.mediaId!)?.id),
        enabled: command => !!command.mediaId && transcription.getTask(command.mediaId)?.status === "failed",
        label: label("transcription.actions.reviewFailure")
    },
    openTranscriptionTask: {
        run: command => openTranscriptionTasks(transcription.getTask(command.mediaId!)?.id),
        enabled: command => !!command.mediaId && !!transcription.getTask(command.mediaId), label: label("transcription.tasks.title")
    },
    selectMedia: {
        run: command => projectAPI.selectMedia(command.mediaId), enabled: command => mediaImport.isSelectable(command.mediaId),
        label: command => mediaImport.getName(command.mediaId)
    },
    renameMedia: { run: command => projectAPI.renameMedia(command.mediaId, command.name), enabled: always, label: label("media.renameHint") },
    moveMedia: {
        run: command => projectAPI.moveMedia(command.mediaId, command.beforeId), enabled: always,
        label: command => mediaImport.getName(command.mediaId)
    },
    removeMedia: { run: command => projectAPI.removeMedia(command.mediaId), enabled: always, label: label("media.actions.remove") },
    retryMediaImportError: { run: command => projectAPI.retryMedia(command.mediaId), enabled: always, label: label("common.retry") },
    relocateMedia: { run: command => projectAPI.relinkMedia(command.mediaId), enabled: always, label: label("media.reference.actions.relocate") },
    ignoreMediaImportError: { run: command => projectAPI.ignoreMedia(command.mediaId), enabled: always, label: label("media.reference.actions.ignore") },
    reviewMediaImportError: { run: command => projectAPI.reviewMedia(command.mediaId), enabled: always, label: label("media.import.failure.title") },
    playSelectedMedia: {
        run: () => playerAPI.togglePlaying(), enabled: hasPlayback,
        label: () => i18n.t(player.isPlaying() ? "player.actions.pause" : "player.actions.play")
    },
    cyclePlaybackMode: { run: () => playerAPI.cycleMode(), enabled: always, label: () => i18n.t(`player.modes.${player.getMode()}`) },
    focus: {
        // Closing menus must release focus before the target receives it.
        run: command => void tick().then(() => focus(command.target)), enabled: always, label: label("player.actions.focusSlider")
    },
    setPlaybackSpeed: { run: command => playerAPI.setSpeed(command.speed), enabled: always, label: command => `${command.speed}×` },
    savePlaybackSpeed: { run: () => playerAPI.saveSpeed(), enabled: always, label: label("common.save") },
    restorePlaybackSpeed: { run: () => playerAPI.restoreSpeed(), enabled: always, label: label("player.actions.restoreSpeed") },
    setPlaybackVolume: { run: command => playerAPI.setVolume(command.volume), enabled: always, label: command => `${command.volume * 100}%` },
    toggleVolumeStabilization: {
        run: () => playerAPI.toggleVolumeStabilization(), enabled: always,
        label: () => i18n.t(player.isVolumeStabilizationEnabled() ? "player.actions.disableStabilization" : "player.actions.enableStabilization")
    },
    seekSelectedMedia: { run: command => projectAPI.seekPlayback(command.time, command.mode), enabled: hasPlayback, label: label("player.actions.focusSlider") },
    selectAdjacentMedia: {
        run: command => projectAPI.selectMedia(mediaSelection.adjacent(command.direction, true)),
        enabled: command => mediaSelection.adjacent(command.direction, true) !== null,
        label: command => i18n.t(command.direction === -1 ? "player.actions.previousMedia" : "player.actions.nextMedia")
    },
    moveSelectedMedia: {
        run: command => {
            const move = adjacentMediaMove(command.direction);
            if (move) projectAPI.moveMedia(move.mediaId, move.beforeId);
        },
        enabled: command => adjacentMediaMove(command.direction) !== null,
        label: command => i18n.t(command.direction === -1 ? "media.actions.moveEarlier" : "media.actions.moveLater")
    },
    seekWord: { run: command => seekWord(command.time), enabled: command => hasPlayback() && Number.isFinite(command.time), label: label("player.actions.focusSlider") },
    seekAdjacentWord: {
        run: command => seekWord(wordPosition(command.direction, command.fromWordIndex)),
        enabled: command => hasPlayback() && wordPosition(command.direction, command.fromWordIndex) !== null,
        label: command => i18n.t(command.direction === -1 ? "player.actions.previousWord" : "player.actions.nextWord")
    },
    openDevTools: { run: () => window.api.openDevTools(), enabled: always, label: label("menu.other.developerTools") },
    openProjectRepository: {
        run: () => {
            window.open("https://github.com/vestige-lixue/vestige", "_blank");
        },
        enabled: always, label: label("menu.other.repository")
    }
};

function definition<Kind extends Command["kind"]>(kind: Kind): CommandDefinition<Kind> {
    return definitions[kind];
}

export function commandDisabled(command: Command): boolean {
    return !definition(command.kind).enabled(command);
}

export function commandLabel(command: Command): string {
    return definition(command.kind).label(command);
}

export function runCommand(command: Command): void {
    if (!interfaceBlocked() && !commandDisabled(command)) definition(command.kind).run(command);
}