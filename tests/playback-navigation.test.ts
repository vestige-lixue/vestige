import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type PlaybackMode } from "../shared/settings/Settings";
import { commandLabel, runCommand } from "../renderer/states/commands";
import { menuItems } from "../renderer/menuModel";
import * as playerAPI from "../renderer/states/player";

const playback = vi.hoisted(() => ({
    mediaId: "A", nextMediaId: "B" as string | null, mode: "sequential" as PlaybackMode,
    state: { url: "media:A" as string | null, currentTime: 20, seekVersion: 0, navigationVersion: 0, playing: true, playVersion: 0, seekMode: "commit" },
    wordStarts: [10, 20, 30], wordIndex: vi.fn(() => 0),
    seek: vi.fn((time: number) => {
        playback.state.currentTime = Math.max(0, Math.min(60, time));
        playback.state.seekVersion++;
        playback.state.navigationVersion++;
    })
}));

vi.mock("../renderer/states/player.svelte", () => ({
    state: playback.state, getURL: () => playback.state.url, getCurrentTime: () => playback.state.currentTime,
    getSeekVersion: () => playback.state.seekVersion, getSeekMode: () => playback.state.seekMode,
    getNavigationVersion: () => playback.state.navigationVersion,
    isPlaying: () => playback.state.playing, getMode: () => playback.mode
}));
vi.mock("../renderer/states/project", () => ({
    seekPlayback: playback.seek,
    selectMedia: (id: string) => {
        playback.mediaId = id;
        playback.state.currentTime = 0;
    }
}));
vi.mock("../renderer/states/project.svelte", () => ({
    projectState: { locked: false, error: null }, saveConfirmation: { pending: false }, getMedia: () => ({ duration: 60 })
}));
vi.mock("../renderer/states/mediaSelection.svelte", () => ({ get: () => playback.mediaId, adjacent: () => playback.nextMediaId }));
vi.mock("../renderer/states/settings.svelte", () => ({
    getPlayback: () => ({ mode: playback.mode, rewindStepMs: 2000, startRewindMs: 0 })
}));
vi.mock("../renderer/states/settings", () => ({ update: vi.fn() }));
vi.mock("../renderer/states/mediaImport.svelte", () => ({
    isPicking: () => false, isCollecting: () => false, getIssue: () => null, getImportFailures: () => [], isRelocating: () => false
}));
vi.mock("../renderer/states/mediaImport", () => ({ updateValidationPlayback: vi.fn() }));
vi.mock("../renderer/states/dialogs.svelte", () => ({ state: { dialogs: [] } }));
vi.mock("../renderer/states/dialogs", () => ({}));
vi.mock("../renderer/states/transcription.svelte", () => ({}));
vi.mock("../renderer/states/transcription", () => ({}));
vi.mock("../renderer/states/transcript.svelte", () => ({ getWordStarts: () => playback.wordStarts }));
vi.mock("../renderer/states/transcript", () => ({ getWordIndex: playback.wordIndex }));
vi.mock("../renderer/states/transcriptFind.svelte", () => ({ state: { open: false }, available: () => false, close: vi.fn() }));
vi.mock("../renderer/states/menu.svelte", () => ({ get: () => null }));
vi.mock("../renderer/states/modal.svelte", () => ({ hasOpenLayer: () => false }));
vi.mock("../renderer/i18n.svelte", () => ({ t: (key: string) => key }));
vi.mock("../renderer/focus", () => ({ focus: vi.fn() }));
vi.mock("../renderer/edit", () => ({ runEdit: () => false }));
vi.mock("../renderer/editor/transcript", () => ({ isTranscriptEditorTarget: () => false }));

class KeyEvent extends Event {
    ctrlKey = false;
    metaKey = false;
    altKey = false;
    shiftKey = false;
    isComposing = false;
    keyCode = 0;

    constructor(readonly key: string, readonly repeat = false, type = "keydown") {
        super(type, { cancelable: true });
    }

    getModifierState(): boolean {
        return false;
    }
}

let keyboard: typeof import("../renderer/keybindings");
let unmount: () => void;

beforeAll(async () => {
    vi.stubGlobal("window", Object.assign(new EventTarget(), { api: { platform: "win32" } }));
    vi.stubGlobal("HTMLElement", class {});
    keyboard = await import("../renderer/keybindings");
});
beforeEach(() => {
    playback.mediaId = "A";
    playback.nextMediaId = "B";
    playback.mode = "sequential";
    Object.assign(playback.state, { url: "media:A", currentTime: 20, seekVersion: 0, navigationVersion: 0, playing: true, playVersion: 0, seekMode: "commit" });
    playback.seek.mockClear();
    playback.wordIndex.mockClear();
    unmount = keyboard.mount();
});
afterEach(() => unmount());
afterAll(() => vi.unstubAllGlobals());

function press(key: string, repeat = false): void {
    const event = new KeyEvent(key, repeat);
    if (key.startsWith("Arrow")) keyboard.seekProgress(event as unknown as KeyboardEvent);
    else window.dispatchEvent(event);
}

describe("playback jump commands", () => {
    it.each([false, true])("shares the jump amount and preserves playing=%s", playing => {
        playback.state.playing = playing;
        runCommand({ kind: "jumpSelectedMedia", direction: 1 });
        expect(playback.state.currentTime).toBe(22);
        runCommand({ kind: "jumpSelectedMedia", direction: -1 });
        expect(playback.state.currentTime).toBe(20);
        runCommand({ kind: "jumpSelectedMedia", direction: -1, from: 0 });
        expect(playback.seek).toHaveBeenLastCalledWith(-2);
        expect(playback.state.currentTime).toBe(0);
        runCommand({ kind: "jumpSelectedMedia", direction: 1, from: 59 });
        expect(playback.state.currentTime).toBe(60);
        expect(playback.state.playing).toBe(playing);
    });

    it("keeps menu order, labels and shortcuts distinct by direction", () => {
        const actions = menuItems("play");
        expect(actions).toEqual([
            { kind: "playSelectedMedia" },
            { kind: "jumpSelectedMedia", direction: -1 }, { kind: "jumpSelectedMedia", direction: 1 }, null,
            { kind: "seekAdjacentWord", direction: -1 }, { kind: "seekAdjacentWord", direction: 1 }, null,
            { kind: "selectAdjacentMedia", direction: -1 }, { kind: "selectAdjacentMedia", direction: 1 }, null,
            { kind: "cyclePlaybackMode" }, { kind: "toggleVolumeStabilization" }, { kind: "restorePlaybackSpeed" }
        ]);
        expect(keyboard.shortcut({ kind: "jumpSelectedMedia", direction: -1 })).toBe("F7");
        expect(keyboard.shortcut({ kind: "jumpSelectedMedia", direction: 1 })).toBe("F9");
        expect(commandLabel({ kind: "jumpSelectedMedia", direction: -1 })).toBe("player.actions.rewind");
        expect(commandLabel({ kind: "jumpSelectedMedia", direction: 1 })).toBe("player.actions.forward");
    });
});

describe.each([
    ["F7", 18, 16], ["F9", 22, 24], ["ArrowLeft", 19, 18], ["ArrowRight", 21, 22]
])("held %s navigation", (key, first, second) => {
    it("accumulates from its last logical position despite playback observations", () => {
        press(key as string);
        expect(playback.state.currentTime).toBe(first);
        playback.state.currentTime = 35;
        press(key as string, true);
        expect(playback.state.currentTime).toBe(second);
    });

    it("ignores repeats without an initial keydown", () => {
        press(key as string, true);
        expect(playback.seek).not.toHaveBeenCalled();
    });

    it.each(["media", "seek"])("rejects all later repeats after another %s change", change => {
        press(key as string);
        if (change === "media") playback.mediaId = "B";
        else playerAPI.updatePlaybackTime(30, "commit");
        playback.state.currentTime = 30;
        press(key as string, true);
        press(key as string, true);
        expect(playback.seek).toHaveBeenCalledTimes(1);
        expect(playback.state.currentTime).toBe(30);
        press(key as string);
        expect(playback.seek).toHaveBeenCalledTimes(2);
    });

    it("requires a new keydown after keyup or pointer cancellation", () => {
        press(key as string);
        window.dispatchEvent(new KeyEvent(key as string, false, "keyup"));
        press(key as string, true);
        expect(playback.seek).toHaveBeenCalledTimes(1);
        press(key as string);
        window.dispatchEvent(new Event("pointerdown"));
        press(key as string, true);
        expect(playback.seek).toHaveBeenCalledTimes(2);
    });
});

it.each([["F9", "F7"], ["ArrowRight", "ArrowLeft"]])("requires a new keydown when switching %s to %s", (forward, backward) => {
    press(forward);
    press(backward, true);
    press(forward, true);
    expect(playback.seek).toHaveBeenCalledTimes(1);
    press(backward);
    window.dispatchEvent(new KeyEvent(forward, false, "keyup"));
    playback.state.currentTime = 35;
    press(backward, true);
    expect(playback.state.currentTime).toBe(backward === "F7" ? 18 : 19);
});

describe.each(["F9", "ArrowRight"])("%s at completion", key => {
    it.each([
        ["single", "B"], ["sequential", "B"], ["sequential", null],
        ["repeat-one", "B"], ["repeat-all", "B"], ["repeat-all", null]
    ] as const)("breaks repeats in %s mode with next=%s", (mode, nextMediaId) => {
        playback.mode = mode;
        playback.nextMediaId = nextMediaId;
        playback.state.currentTime = 59;
        press(key);
        expect(playback.state.currentTime).toBe(60);
        const navigationVersion = playback.state.navigationVersion;
        const seekVersion = playback.state.seekVersion;
        playerAPI.finishPlayback();
        expect(playback.state.navigationVersion).toBeGreaterThan(navigationVersion);
        const switches = (mode === "sequential" || mode === "repeat-all") && nextMediaId !== null;
        const stops = mode === "single" || mode === "sequential" && nextMediaId === null;
        // Replaying needs one real seek to zero; completion itself must not request a seek.
        if (!switches && !stops) expect(playback.state.seekVersion).toBe(seekVersion + 1);
        else expect(playback.state.seekVersion).toBe(seekVersion);
        expect(playback.mediaId).toBe(switches ? "B" : "A");
        expect(playback.state.currentTime).toBe(stops ? 60 : 0);
        expect(playback.state.playing).toBe(!stops);
        const seeks = playback.seek.mock.calls.length;
        playback.state.currentTime = 0.25;
        press(key, true);
        press(key, true);
        expect(playback.seek).toHaveBeenCalledTimes(seeks);
        expect(playback.state.currentTime).toBe(0.25);
        press(key);
        expect(playback.seek).toHaveBeenCalledTimes(seeks + 1);
    });
});

it("advances both counters for seeks and neither for playback observations", () => {
    playerAPI.updatePlaybackTime(21, null);
    expect(playback.state.seekVersion).toBe(0);
    expect(playback.state.navigationVersion).toBe(0);
    playerAPI.updatePlaybackTime(22, "preview");
    expect(playback.state.seekVersion).toBe(1);
    expect(playback.state.navigationVersion).toBe(1);
    playerAPI.updatePlaybackTime(23, "commit");
    expect(playback.state.seekVersion).toBe(2);
    expect(playback.state.navigationVersion).toBe(2);
});

describe("word navigation counters", () => {
    function pressWord(repeat = false): void {
        const event = new KeyEvent("ArrowRight", repeat);
        event.altKey = true;
        window.dispatchEvent(event);
    }

    it("keeps the logical word index when one command also seeks for rewind-on-start", () => {
        const run = vi.fn(() => {
            playerAPI.updatePlaybackTime(20, "commit");
            playerAPI.updatePlaybackTime(18, "commit");
        });
        const unregister = keyboard.registerMenu({ keyboard: () => {}, toggle: () => {}, edit: () => {}, run });
        try {
            pressWord();
            pressWord(true);
            expect(run).toHaveBeenNthCalledWith(1, { kind: "seekAdjacentWord", direction: 1, fromWordIndex: 0 });
            expect(run).toHaveBeenNthCalledWith(2, { kind: "seekAdjacentWord", direction: 1, fromWordIndex: 1 });
            expect(playback.wordIndex).toHaveBeenCalledTimes(1);
        }
        finally {
            unregister();
        }
    });

    it("re-evaluates the word after completion changes only the navigation counter", () => {
        const run = vi.fn(() => playerAPI.updatePlaybackTime(20, "commit"));
        const unregister = keyboard.registerMenu({ keyboard: () => {}, toggle: () => {}, edit: () => {}, run });
        try {
            pressWord();
            playback.mode = "single";
            playback.state.currentTime = 60;
            const seekVersion = playback.state.seekVersion;
            playerAPI.finishPlayback();
            expect(playback.state.seekVersion).toBe(seekVersion);
            pressWord(true);
            expect(run).toHaveBeenLastCalledWith({ kind: "seekAdjacentWord", direction: 1, fromWordIndex: 0 });
            expect(playback.wordIndex).toHaveBeenCalledTimes(2);
        }
        finally {
            unregister();
        }
    });
});