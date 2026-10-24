import { type EditAction } from "../shared/app";
import { runEdit } from "./edit";
import { interfaceBlocked, runCommand, type Command } from "./states/commands";
import * as menu from "./states/menu.svelte";
import * as player from "./states/player.svelte";
import * as mediaSelection from "./states/mediaSelection.svelte";
import * as transcript from "./states/transcript.svelte";
import * as transcriptAPI from "./states/transcript";

type Shortcut = { key: string; mod?: boolean; shift?: boolean };
type Binding = Shortcut & { command: Command | (() => Command) };
type MenuBindings = {
    keyboard: () => void;
    toggle: () => void;
    run: (command: Command) => void;
    edit: (action: EditAction) => void;
};

const bindings: readonly Binding[] = [
    { key: "n", mod: true, command: { kind: "newProject" } },
    { key: "o", mod: true, command: { kind: "openProject" } },
    { key: "s", mod: true, command: { kind: "saveProject" } },
    { key: "s", mod: true, shift: true, command: { kind: "saveProjectAs" } },
    { key: "w", mod: true, command: { kind: "closeProject" } },
    { key: "q", mod: true, command: { kind: "quitApp" } },
    { key: "i", mod: true, command: { kind: "importMedia" } },
    { key: "r", mod: true, command: { kind: "restorePlaybackSpeed" } },
    { key: "e", mod: true, command: { kind: "toggleVolumeStabilization" } },
    { key: "l", mod: true, command: { kind: "openPanel", panel: "vocabulary" } },
    { key: "t", mod: true, command: { kind: "openPanel", panel: "tasks" } },
    { key: ",", mod: true, command: { kind: "openPanel", panel: "settings" } },
    { key: "b", mod: true, command: () => ({ kind: "openTranscriptionConfig", mediaId: mediaSelection.get() }) },
    { key: "p", mod: true, shift: true, command: { kind: "focus", target: "playback-progress" } },
    { key: "r", mod: true, shift: true, command: { kind: "focus", target: "playback-speed" } },
    { key: "e", mod: true, shift: true, command: { kind: "focus", target: "playback-volume" } },
    { key: "m", mod: true, shift: true, command: { kind: "cyclePlaybackMode" } },
    { key: "arrowleft", mod: true, command: { kind: "seekAdjacentWord", direction: -1 } },
    { key: "arrowright", mod: true, command: { kind: "seekAdjacentWord", direction: 1 } },
    { key: "arrowleft", mod: true, shift: true, command: { kind: "selectAdjacentMedia", direction: -1 } },
    { key: "arrowright", mod: true, shift: true, command: { kind: "selectAdjacentMedia", direction: 1 } },
    { key: " ", command: { kind: "playSelectedMedia" } }
];

const editKeys: Record<string, EditAction> = { a: "selectAll", z: "undo", y: "redo", x: "cut", c: "copy", v: "paste" };
let menuBindings: MenuBindings | null = null;
let mounted = false;
let alt: "idle" | "pressed" = "idle";
let wordNavigation: {
    direction: -1 | 1; mediaId: string | null; starts: readonly number[]; index: number; seekVersion: number;
} | null = null;
let progressNavigation: { direction: -1 | 1; mediaId: string | null; time: number; seekVersion: number } | null = null;

export function registerMenu(bindings: MenuBindings): () => void {
    menuBindings = bindings;
    return () => {
        if (menuBindings === bindings) menuBindings = null;
    };
}

function isMac(): boolean {
    return window.api.platform === "darwin";
}

function formatShortcut(shortcut: Shortcut): string {
    const key = ({ arrowleft: "←", arrowright: "→", " ": "Space" } as Record<string, string>)[shortcut.key] ?? shortcut.key.toUpperCase();
    return [...(shortcut.mod ? [isMac() ? "⌘" : "Ctrl"] : []), ...(shortcut.shift ? ["⇧"] : []), key].join("+");
}

function commandIdentity(command: Command): string {
    if (command.kind === "openPanel") return `${command.kind}:${command.panel}`;
    if (command.kind === "focus") return `${command.kind}:${command.target}`;
    if ("direction" in command) return `${command.kind}:${command.direction}`;
    return command.kind;
}

function boundCommand(binding: Binding): Command {
    return typeof binding.command === "function" ? binding.command() : binding.command;
}

export function shortcut(command: Command): string | undefined {
    if (command.kind === "openDevTools") return formatShortcut({ key: "F12" }); // Electron owns this native shortcut.
    if (command.kind === "openTranscriptionTask" || command.kind === "reviewTranscriptionError") return shortcut({ kind: "openPanel", panel: "tasks" });
    const identity = commandIdentity(command);
    const binding = bindings.find(candidate => commandIdentity(boundCommand(candidate)) === identity);
    return binding ? formatShortcut(binding) : undefined;
}

export function editShortcut(action: EditAction): string {
    if (action === "redo" && isMac()) return formatShortcut({ key: "z", mod: true, shift: true });
    return formatShortcut({ key: Object.keys(editKeys).find(key => editKeys[key] === action)!, mod: true });
}

export function cancelProgressNavigation(): void {
    progressNavigation = null;
}

function cancel(): void {
    alt = "idle";
    wordNavigation = null;
    cancelProgressNavigation();
}

function editingTarget(target: EventTarget | null): target is HTMLElement {
    return target instanceof HTMLElement && (target.closest("input, textarea") !== null || target.isContentEditable);
}

function run(command: Command): void {
    if (menuBindings) menuBindings.run(command);
    else runCommand(command);
}

function runWord(direction: -1 | 1, repeat: boolean): void {
    if (interfaceBlocked() || !player.getURL()) {
        wordNavigation = null;
        return;
    }
    const mediaId = mediaSelection.get();
    const starts = transcript.getWordStarts();
    const seekVersion = player.getSeekVersion();
    // Repeats advance from this key's prior word, only while its own seeks remain current.
    if (!repeat || !wordNavigation || wordNavigation.direction !== direction || wordNavigation.mediaId !== mediaId
        || wordNavigation.starts !== starts || wordNavigation.seekVersion !== seekVersion) {
        wordNavigation = { direction, mediaId, starts, index: transcriptAPI.getWordIndex(player.getCurrentTime()), seekVersion };
    }
    const navigation = wordNavigation;
    run({ kind: "seekAdjacentWord", direction, fromWordIndex: navigation.index });
    const nextVersion = player.getSeekVersion();
    if (nextVersion === seekVersion + 1) {
        navigation.index += direction;
        navigation.seekVersion = nextVersion;
    }
    else if (nextVersion !== seekVersion) wordNavigation = null;
}

export function seekProgress(event: KeyboardEvent): void {
    if (interfaceBlocked() || !player.getURL() || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
        || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) {
        cancelProgressNavigation();
        return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const mediaId = mediaSelection.get();
    const seekVersion = player.getSeekVersion();
    const time = event.repeat && progressNavigation?.direction === direction && progressNavigation.mediaId === mediaId
        && progressNavigation.seekVersion === seekVersion ? progressNavigation.time : player.getCurrentTime();
    runCommand({ kind: "seekSelectedMedia", time: direction === 1 ? Math.floor(time) + 1 : Math.ceil(time) - 1 });
    progressNavigation = player.getSeekVersion() === seekVersion + 1
        ? { direction, mediaId, time: player.getCurrentTime(), seekVersion: player.getSeekVersion() } : null;
}

function preventSpaceActivation(event: KeyboardEvent): void {
    if (interfaceBlocked() || event.key !== " " || event.isComposing || editingTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
}

function keydown(event: KeyboardEvent): void {
    menuBindings?.keyboard();
    if (event.key === "Alt") {
        if (!event.repeat) {
            wordNavigation = null;
            alt = !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey
                && !event.isComposing && !event.getModifierState("AltGraph") && !interfaceBlocked() ? "pressed" : "idle";
        }
        return;
    }
    alt = "idle";
    if (interfaceBlocked() || event.defaultPrevented || event.isComposing || event.altKey || event.getModifierState("AltGraph")) {
        wordNavigation = null;
        return;
    }
    const mod = isMac() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    const key = event.key.toLowerCase();
    const editing = editingTarget(event.target);
    const edit = mod ? event.shiftKey ? key === "z" ? "redo" : undefined : editKeys[key] : undefined;
    if (edit && (menu.get() || editing && runEdit(event.target, edit, false))) {
        wordNavigation = null;
        event.preventDefault();
        event.stopPropagation();
        if (menu.get()) menuBindings?.edit(edit);
        return;
    }
    const binding = bindings.find(candidate => candidate.key === key && !!candidate.mod === mod && !!candidate.shift === event.shiftKey
        && (candidate.mod || !event.ctrlKey && !event.metaKey));
    const action = binding && !(editing && (key === " " || key === "arrowleft" || key === "arrowright")) ? boundCommand(binding) : undefined;
    if (action?.kind !== "seekAdjacentWord") wordNavigation = null;
    if (action) {
        event.preventDefault();
        event.stopPropagation();
        if (action.kind === "seekAdjacentWord") runWord(action.direction, event.repeat);
        else if (!event.repeat) run(action);
    }
    // Space cannot also activate the focused button on keydown or keyup.
    preventSpaceActivation(event);
}

function keyup(event: KeyboardEvent): void {
    if (wordNavigation && (event.key === (wordNavigation.direction === -1 ? "ArrowLeft" : "ArrowRight")
        || event.key === (isMac() ? "Meta" : "Control"))) wordNavigation = null;
    if (progressNavigation && event.key === (progressNavigation.direction === -1 ? "ArrowLeft" : "ArrowRight")) cancelProgressNavigation();
    preventSpaceActivation(event);
    const toggle = alt === "pressed" && event.key === "Alt" && !event.defaultPrevented
        && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.isComposing && !event.getModifierState("AltGraph") && !interfaceBlocked();
    alt = "idle";
    if (toggle) {
        event.preventDefault();
        menuBindings?.toggle();
    }
}

function progressKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    const target = event.target;
    if (menu.get() || !(target instanceof HTMLElement) || target.isContentEditable || target.closest("input, textarea, select, [data-slider-root]")) {
        cancelProgressNavigation();
        return;
    }
    seekProgress(event);
}

export function mount(): () => void {
    if (mounted) return () => {};
    mounted = true;
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keydown", progressKeydown);
    window.addEventListener("keyup", keyup, true);
    window.addEventListener("pointerdown", cancel, true);
    window.addEventListener("focusin", cancelProgressNavigation);
    window.addEventListener("blur", cancel);
    return () => {
        mounted = false;
        cancel();
        window.removeEventListener("keydown", keydown, true);
        window.removeEventListener("keydown", progressKeydown);
        window.removeEventListener("keyup", keyup, true);
        window.removeEventListener("pointerdown", cancel, true);
        window.removeEventListener("focusin", cancelProgressNavigation);
        window.removeEventListener("blur", cancel);
    };
}