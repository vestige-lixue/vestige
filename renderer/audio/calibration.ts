import * as playback from "./playback";
import { type VolumeStabilizationSettings } from "../../shared/settings/Settings";
import { minAudioOffsetMs, maxAudioOffsetMs } from "../../shared/constants";
import { monoPcm16Header } from "../../shared/audio/wave";

export const beatSeconds = 60 / 90;
export const trialSeconds = beatSeconds * 3;
export const cycleSeconds = trialSeconds + 2;

export type Calibration = {
    readonly element: HTMLAudioElement;
    readonly pipeline: playback.PlaybackAudio;
    readonly url: string;
    disposed: boolean;
    ready: boolean;
    cycles: number;
    lastTime: number;
    lastRound: number;
    count: number;
    mean: number;
};

// A loop of PCM audio uses exactly the same media-element/worklet path as normal playback.
// Silence after the three short tones leaves two seconds before the next trial begins.
export function createTrack(): Blob {
    const rate = 48000;
    const peak = 10 ** (-10 / 20);
    const toneSeconds = 0.036;
    const samples = Math.round(cycleSeconds * rate);
    const header = monoPcm16Header(rate, samples * 2);
    const data = new Uint8Array(header.byteLength + samples * 2);
    data.set(header);
    const view = new DataView(data.buffer);
    for (let beat = 0; beat < 3; beat++) {
        const start = Math.round((beat + 1) * beatSeconds * rate);
        const frequency = beat === 2 ? 1350 : 900;
        for (let i = 0; i < Math.round(toneSeconds * rate); i++) {
            const t = i / rate;
            // A short sustain keeps the cue audible, with smooth edges and a -10 dBFS peak.
            const envelope = peak * Math.min(1, t / 0.0015, (toneSeconds - t) / 0.006);
            view.setInt16(header.byteLength + (start + i) * 2, Math.round(Math.sin(2 * Math.PI * frequency * t) * envelope * 32767), true);
        }
    }
    return new Blob([data], { type: "audio/wav" });
}

export function create(volume: number, enabled: boolean, settings: VolumeStabilizationSettings, onStop: () => void, onError: (error: unknown) => void): Calibration {
    const element = new Audio();
    element.preload = "auto";
    element.loop = true;
    const pipeline = playback.create(element, volume, enabled, onError, settings, undefined, onStop);
    const url = URL.createObjectURL(createTrack());
    const calibration: Calibration = { element, pipeline, url, disposed: false, ready: false, cycles: 0, lastTime: 0, lastRound: -1, count: 0, mean: 0 };
    element.onpause = () => {
        if (calibration.ready && !calibration.disposed) onStop();
    };
    element.onwaiting = () => {
        // Native looping seeks back through the silent lead-in and briefly emits waiting.
        if (calibration.ready && !calibration.disposed && !(element.seeking && element.currentTime < beatSeconds)) onStop();
    };
    element.onerror = () => {
        if (!calibration.disposed) onError(element.error);
    };
    element.src = url;
    return calibration;
}

export async function start(calibration: Calibration): Promise<void> {
    await playback.resume(calibration.pipeline);
    if (calibration.disposed) return;
    await calibration.element.play();
    if (!calibration.disposed) calibration.ready = true;
}

export function getTime(calibration: Calibration): number {
    const time = calibration.element.currentTime;
    if (time < calibration.lastTime - cycleSeconds / 2) calibration.cycles++;
    calibration.lastTime = time;
    return calibration.cycles * cycleSeconds + time;
}

export function tap(calibration: Calibration, timestamp: number): number | null {
    const age = performance.now() - timestamp;
    if (calibration.disposed || !calibration.ready || calibration.element.paused || calibration.element.seeking || calibration.element.readyState < 3 || calibration.pipeline.context.state !== "running" || age < -1 || age > 250) return null;
    const time = getTime(calibration) - Math.max(0, age) / 1000;
    const round = Math.round((time - trialSeconds) / cycleSeconds);
    const error = (time - (round * cycleSeconds + trialSeconds)) * 1000;
    if (round < 0 || round <= calibration.lastRound || Math.abs(error) > maxAudioOffsetMs) return null;
    calibration.lastRound = round;
    calibration.count++;
    // Average phase error against the known third beat, not the user's tap interval.
    calibration.mean += (error - calibration.mean) / calibration.count;
    return Math.max(minAudioOffsetMs, Math.min(maxAudioOffsetMs, -Math.round(calibration.mean)));
}

export function dispose(calibration: Calibration): void {
    if (calibration.disposed) return;
    calibration.disposed = true;
    calibration.element.pause();
    playback.dispose(calibration.pipeline);
    calibration.element.removeAttribute("src");
    calibration.element.load();
    calibration.element.onpause = null;
    calibration.element.onwaiting = null;
    calibration.element.onerror = null;
    URL.revokeObjectURL(calibration.url);
}