import { type EditAction } from "../shared/app";
import { type Command } from "./states/commands";
import * as mediaSelection from "./states/mediaSelection.svelte";
import * as transcription from "./states/transcription.svelte";

export type MenuAction = Command | { kind: "edit"; action: EditAction } | { kind: "removeSelectedMedia" };

export const menuGroups = [
    { value: "project", label: "menu.project.title" },
    { value: "media", label: "menu.media.title" },
    { value: "transcription", label: "menu.transcription.title" },
    { value: "edit", label: "menu.edit.title" },
    { value: "play", label: "menu.playback.title" },
    { value: "misc", label: "menu.other.title" }
] as const;
export type MenuGroup = (typeof menuGroups)[number]["value"];

const projectActions: readonly (Command | null)[] = [
    { kind: "newProject" }, { kind: "openProject" }, { kind: "saveProject" }, { kind: "saveProjectAs" }, { kind: "closeProject" }
];
const transcriptionActions: readonly (Command | null)[] = [
    { kind: "openPanel", panel: "vocabulary" }, { kind: "openPanel", panel: "tasks" }, null,
    { kind: "openPanel", panel: "transcription-backends" }, { kind: "openPanel", panel: "transcription-models" }, { kind: "openPanel", panel: "transcription-presets" }
];
export const editActions: readonly (EditAction | null)[] = ["undo", "redo", null, "cut", "copy", "paste", null, "selectAll"];
const playActions: readonly (Command | null)[] = [
    { kind: "playSelectedMedia" },
    { kind: "jumpSelectedMedia", direction: -1 }, { kind: "jumpSelectedMedia", direction: 1 }, null,
    { kind: "seekAdjacentWord", direction: -1 }, { kind: "seekAdjacentWord", direction: 1 }, null,
    { kind: "selectAdjacentMedia", direction: -1 }, { kind: "selectAdjacentMedia", direction: 1 }, null,
    { kind: "cyclePlaybackMode" }, { kind: "toggleVolumeStabilization" }, { kind: "restorePlaybackSpeed" }
];
const settings: Command = { kind: "openPanel", panel: "settings" };
const about: Command = { kind: "openPanel", panel: "about" };
export const quitAction: Command = { kind: "quitApp" };
export const applicationActions: readonly (Command | null)[] = [about, null, settings];
export const helpActions: readonly (Command | null)[] = [
    { kind: "openDevTools" }, null, { kind: "openPanel", panel: "guide" }, { kind: "openProjectRepository" }, { kind: "openPanel", panel: "licenses" }
];
const miscActions: readonly (Command | null)[] = [settings, ...helpActions, about, null, quitAction];

function transcriptionCommand(): Command {
    const mediaId = mediaSelection.get();
    const task = mediaId ? transcription.getTask(mediaId) : null;
    return { kind: task?.status === "failed" ? "reviewTranscriptionError" : transcription.isPending(task) ? "stopTranscription" : "openTranscriptionConfig", mediaId };
}

export function menuItems(group: MenuGroup): readonly (MenuAction | null)[] {
    switch (group) {
        case "project": return projectActions;
        case "media": return [
            { kind: "importMedia" }, null,
            { kind: "moveSelectedMedia", direction: -1 }, { kind: "moveSelectedMedia", direction: 1 }, null,
            transcriptionCommand(), { kind: "removeSelectedMedia" }
        ];
        case "transcription": return [transcriptionCommand(), null, ...transcriptionActions];
        case "edit": return [
            ...editActions.map(action => action ? { kind: "edit" as const, action } : null),
            null, { kind: "openTranscriptFind" }, { kind: "openTranscriptReplace" }
        ];
        case "play": return playActions;
        case "misc": return miscActions;
    }
}