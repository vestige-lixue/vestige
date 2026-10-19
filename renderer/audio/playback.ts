import processorURL from "./volumeStabilizer.worklet.js?url&no-inline";
import meterURL from "./levelMeter.worklet.js?url&no-inline";
import { readLevels, silenceLevels, type AudioLevels, type LevelMessage } from "./levels";
import { type VolumeStabilizationSettings } from "../../shared/settings/Settings";
import { defaultSettings } from "../../shared/settings/defaults";

export type PlaybackAudio = {
    readonly element: HTMLMediaElement;
    readonly context: AudioContext;
    readonly source: MediaElementAudioSourceNode;
    readonly master: GainNode;
    readonly meterSource: DelayNode;
    readonly initialized: Promise<void>;
    readonly onFailure: (error: unknown) => void;
    readonly onLevels: (levels: AudioLevels | null) => void;
    readonly onInterruption: () => void;
    readonly resetListener: () => void;
    readonly stateListener: () => void;
    processor: AudioWorkletNode | null;
    meter: AudioWorkletNode | null;
    meterGeneration: number;
    levels: AudioLevels | null;
    disposed: boolean;
    playing: boolean;
    running: boolean;
    playVersion: number;
    suspension: Promise<void>;
    failed: boolean;
    enabled: boolean;
    settings: VolumeStabilizationSettings;
};

export function create(element: HTMLMediaElement, volume: number, enabled: boolean, onFailure: (error: unknown) => void, settings: VolumeStabilizationSettings = defaultSettings.volumeStabilization, onLevels: (levels: AudioLevels | null) => void = () => {}, onInterruption: () => void = () => {}): PlaybackAudio {
    const context = new AudioContext({ latencyHint: "interactive", sampleRate: 48000 });
    const master = context.createGain();
    master.gain.value = volume;
    master.connect(context.destination);
    let source: MediaElementAudioSourceNode;
    try {
        source = context.createMediaElementSource(element);
    }
    catch (error) {
        void context.close();
        throw error;
    }
    source.connect(master);
    element.volume = 1;
    const suspension = context.suspend().catch(console.error);

    const audio: PlaybackAudio = {
        element, context, source, master, enabled, settings, onFailure, onLevels, onInterruption, suspension,
        meterSource: context.createDelay(), meter: null, meterGeneration: 0, levels: null,
        processor: null, disposed: false, playing: false, running: false, playVersion: 0, failed: false,
        resetListener: () => reset(audio),
        stateListener: () => observeState(audio),
        initialized: context.audioWorklet.addModule(processorURL).then(() => {
            if (audio.disposed) return;
            audio.processor = new AudioWorkletNode(context, "vestige-volume-stabilizer", {
                processorOptions: { enabled: audio.enabled, settings: audio.settings }
            });
            audio.processor.onprocessorerror = () => fail(audio, new Error("The volume stabilization processor failed."));
            source.disconnect();
            source.connect(audio.processor).connect(master);
        }).catch(error => fail(audio, error)).then(async () => {
            if (audio.disposed) return;
            await context.audioWorklet.addModule(meterURL);
            if (audio.disposed) return;
            const meter = new AudioWorkletNode(context, "vestige-level-meter", {
                numberOfInputs: 3, numberOfOutputs: 1, outputChannelCount: [1], channelCountMode: "max"
            });
            audio.meter = meter;
            meter.onprocessorerror = () => failMeter(audio, new Error("The audio level meter failed."));
            meter.port.onmessage = ({ data }: MessageEvent<LevelMessage>) => {
                if (audio.disposed || audio.meter !== meter || !audio.playing || data.generation !== audio.meterGeneration) return;
                audio.levels = readLevels(data, audio.levels, performance.now(), context.currentTime);
                audio.onLevels(audio.levels);
            };
            connectMeter(audio);
            resetMeter(audio);
        }).catch(error => failMeter(audio, error))
    };
    // Reset once after seeking completes, when the new playback position is established.
    element.addEventListener("seeked", audio.resetListener);
    context.addEventListener("statechange", audio.stateListener);
    return audio;
}

function observeState(audio: PlaybackAudio): void {
    if (audio.disposed) return;
    const state = audio.context.state;
    if (state === "running") {
        // An interruption ending must not restart audio after playback was paused.
        if (audio.playing) audio.running = true;
        else pause(audio);
    }
    else if (audio.playing && (audio.running || state === "interrupted" || state === "closed")) {
        pause(audio);
        audio.onInterruption();
    }
}

function fail(audio: PlaybackAudio, error: unknown): void {
    if (audio.disposed || audio.failed) return;
    audio.failed = true;
    audio.source.disconnect();
    audio.processor?.disconnect();
    audio.processor?.port.close();
    audio.processor = null;
    audio.source.connect(audio.master);
    connectMeter(audio);
    resetMeter(audio, 0);
    audio.onFailure(error);
}

function connectMeter(audio: PlaybackAudio): void {
    if (!audio.meter) return;
    // Align source measurements with the stabilizer's lookahead, only in the meter branch.
    audio.meterSource.delayTime.value = audio.processor ? Math.round(audio.context.sampleRate * 0.005) / audio.context.sampleRate : 0;
    audio.source.connect(audio.meterSource).connect(audio.meter, 0, 0);
    (audio.processor ?? audio.source).connect(audio.meter, 0, 1);
    audio.master.connect(audio.meter, 0, 2);
    // The meter emits silence; playback still reaches the destination directly from master.
    audio.meter.connect(audio.context.destination);
}

function failMeter(audio: PlaybackAudio, error: unknown): void {
    if (audio.disposed) return;
    if (audio.meter) {
        audio.source.disconnect(audio.meterSource);
        audio.meterSource.disconnect();
        (audio.processor ?? audio.source).disconnect(audio.meter);
        audio.master.disconnect(audio.meter);
        audio.meter.disconnect();
        audio.meter.port.close();
        audio.meter = null;
    }
    audio.levels = null;
    audio.onLevels(null);
    console.error("Audio level metering is unavailable.", error);
}

function resetMeter(audio: PlaybackAudio, sourceWarmup?: number): void {
    audio.meter?.port.postMessage({ type: "reset", generation: ++audio.meterGeneration, sourceWarmup });
    audio.levels = silenceLevels(audio.levels);
    audio.onLevels(audio.levels);
}

export async function resume(audio: PlaybackAudio): Promise<void> {
    const version = ++audio.playVersion;
    audio.playing = true;
    await audio.initialized;
    await audio.suspension;
    if (audio.disposed || !audio.playing || version !== audio.playVersion) return;
    if (audio.context.state !== "running") {
        resetMeter(audio);
        await audio.context.resume();
    }
    if (audio.disposed) return;
    if (!audio.playing) pause(audio);
    else if (version === audio.playVersion) audio.running = audio.context.state === "running";
}

export function pause(audio: PlaybackAudio): void {
    audio.playVersion++;
    audio.playing = false;
    audio.running = false;
    if (!audio.disposed) {
        resetMeter(audio);
        if (audio.context.state !== "closed") audio.suspension = audio.context.suspend().catch(console.error);
    }
}

export function setVolume(audio: PlaybackAudio, volume: number): void {
    if (audio.disposed) return;
    const time = audio.context.currentTime;
    audio.master.gain.cancelAndHoldAtTime(time);
    audio.master.gain.setTargetAtTime(volume, time, 0.015);
}

export function setEnabled(audio: PlaybackAudio, enabled: boolean): void {
    if (audio.disposed) return;
    audio.enabled = enabled;
    if (audio.failed && enabled) audio.onFailure(new Error("The volume stabilization processor is unavailable."));
    else audio.processor?.port.postMessage({ type: "enabled", enabled });
}

export function setSettings(audio: PlaybackAudio, settings: VolumeStabilizationSettings): void {
    if (audio.disposed) return;
    audio.settings = settings;
    audio.processor?.port.postMessage({ type: "settings", settings });
}

export function reset(audio: PlaybackAudio): void {
    if (audio.disposed) return;
    audio.processor?.port.postMessage({ type: "reset" });
    // The source delay still holds pre-seek samples while the processor clears its buffer.
    resetMeter(audio, audio.processor ? Math.round(audio.context.sampleRate * 0.005) : 0);
}

export function dispose(audio: PlaybackAudio): void {
    if (audio.disposed) return;
    audio.disposed = true;
    audio.playing = false;
    audio.element.removeEventListener("seeked", audio.resetListener);
    audio.context.removeEventListener("statechange", audio.stateListener);
    audio.source.disconnect();
    audio.processor?.disconnect();
    audio.processor?.port.close();
    audio.processor = null;
    audio.meterSource.disconnect();
    audio.meter?.disconnect();
    audio.meter?.port.close();
    audio.meter = null;
    audio.master.disconnect();
    audio.onLevels(null);
    void audio.context.close();
}