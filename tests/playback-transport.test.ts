import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as playbackTransport from "../renderer/audio/transport";

class Media extends EventTarget {
    currentTime = 0;
    duration = 60;
    readyState = 4;
    seeking = false;
    paused = true;
    ended = false;
    muted = false;
    play = vi.fn(async () => {
        this.paused = false;
    });
    pause = vi.fn(() => {
        this.paused = true;
    });
    requestVideoFrameCallback = vi.fn(() => 1);
    cancelVideoFrameCallback = vi.fn();

    settle(): void {
        this.dispatchEvent(new Event("seeked"));
    }
}

let audio: Media;
let video: Media;
let transport: playbackTransport.Transport;
let onEnded: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.useFakeTimers();
    audio = new Media();
    video = new Media();
    onEnded = vi.fn();
    transport = playbackTransport.create(audio as unknown as HTMLMediaElement, video as unknown as HTMLVideoElement, {
        duration: 60, resumeAudio: async () => {}, pauseAudio: () => {}, drainSeconds: () => 0,
        onTime: vi.fn(), onEnded, onInterruption: vi.fn(), onError: vi.fn(), onClamp: vi.fn()
    });
    playbackTransport.seek(transport, 55, "commit");
    audio.settle();
    video.settle();
});
afterEach(() => {
    playbackTransport.dispose(transport);
    vi.useRealTimers();
});

async function start(): Promise<void> {
    playbackTransport.setPlaying(transport, true);
    await vi.advanceTimersByTimeAsync(0);
}

describe("seeking to the end", () => {
    it("finishes playing media once after both elements settle", async () => {
        await start();
        playbackTransport.seek(transport, 62, "commit");
        audio.settle();
        expect(onEnded).not.toHaveBeenCalled();
        video.settle();
        expect(onEnded).toHaveBeenCalledTimes(1);
        expect(playbackTransport.getTime(transport)).toBe(60);
        expect(transport.playing).toBe(false);
        audio.ended = true;
        audio.dispatchEvent(new Event("ended"));
        await vi.advanceTimersByTimeAsync(100);
        expect(onEnded).toHaveBeenCalledTimes(1);
    });

    it("keeps a paused end seek paused without finishing", () => {
        playbackTransport.seek(transport, 60, "commit");
        audio.settle();
        video.settle();
        expect(onEnded).not.toHaveBeenCalled();
        expect(transport.playing).toBe(false);
        expect(playbackTransport.getTime(transport)).toBe(60);
    });

    it("waits for a committed seek before finishing a preview", async () => {
        await start();
        playbackTransport.seek(transport, 60, "preview");
        await vi.advanceTimersByTimeAsync(75);
        audio.settle();
        video.settle();
        audio.ended = true;
        audio.dispatchEvent(new Event("ended"));
        expect(onEnded).not.toHaveBeenCalled();
        playbackTransport.seek(transport, 60, "commit");
        expect(onEnded).toHaveBeenCalledTimes(1);
    });

    it("does not finish when a newer seek replaces the end request", async () => {
        await start();
        playbackTransport.seek(transport, 60, "commit");
        playbackTransport.seek(transport, 30, "commit");
        audio.settle();
        video.settle();
        audio.settle();
        video.settle();
        expect(onEnded).not.toHaveBeenCalled();
        expect(playbackTransport.getTime(transport)).toBe(30);
    });

    it("finishes normally after replaying from the start", async () => {
        await start();
        audio.currentTime = 60;
        audio.ended = true;
        audio.dispatchEvent(new Event("ended"));
        await vi.advanceTimersByTimeAsync(20);
        expect(onEnded).toHaveBeenCalledTimes(1);
        playbackTransport.seek(transport, 0, "commit");
        audio.ended = false;
        audio.settle();
        video.settle();
        await start();
        audio.currentTime = 60;
        audio.ended = true;
        audio.dispatchEvent(new Event("ended"));
        await vi.advanceTimersByTimeAsync(20);
        expect(onEnded).toHaveBeenCalledTimes(2);
    });
});