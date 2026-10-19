import { clipHoldMs, levelStages, levelWidth, type AudioLevels } from "../../audio/levels";
import { type AudioLevelStage } from "../../../shared/settings/Settings";

const releaseMs = 180;
const readoutIntervalMs = 100;
const settledWidth = 0.02;

type Channel = {
    targets: number[];
    widths: number[];
    peak: number;
    pendingPeak: number;
    readout: number;
    clippedAt: number;
};

type DisplayState = {
    channels: Channel[];
    stage: AudioLevelStage;
    time: number | null;
    nextReadout: number;
};

export type DisplayChannel = {
    // Widest to narrowest, independent of measurement stage.
    readonly widths: readonly number[];
    readonly peak: number;
    readonly clipped: boolean;
};

export function create(): DisplayState {
    return { channels: [], stage: "monitor", time: null, nextReadout: 0 };
}

function advanceWidths(state: DisplayState, time: number): void {
    const elapsed = state.time === null ? 0 : Math.max(0, time - state.time);
    const release = Math.exp(-elapsed / releaseMs);
    state.time = Math.max(time, state.time ?? time);
    for (const channel of state.channels) {
        const widths = channel.targets.map((target, index) => {
            const previous = channel.widths[index];
            const width = target >= previous ? target : target + (previous - target) * release;
            return Math.abs(width - target) < settledWidth ? target : width;
        });
        // Equal taps share the lowest envelope, keeping overlap without reviving a silent tap.
        channel.widths = widths.map((width, index) => Math.min(width, ...widths.filter((_, other) =>
            channel.targets[index] === channel.targets[other])));
    }
}

export function update(state: DisplayState, levels: AudioLevels | null, stage: AudioLevelStage, time: number): void {
    // Finish the previous target's elapsed time before applying a new measurement.
    advanceWidths(state, time);
    const count = Math.max(...levelStages.map(key => levels?.[key].length ?? 0));
    const changedStage = state.stage !== stage;
    if (changedStage || count !== state.channels.length) state.nextReadout = 0;
    state.stage = stage;
    state.channels = Array.from({ length: count }, (_, index) => {
        const selected = levels?.[stage][index];
        const peak = selected?.peak ?? 0;
        const channel = state.channels[index] ?? {
            targets: [0, 0, 0], widths: [0, 0, 0], peak: 0,
            pendingPeak: 0, readout: 0, clippedAt: -Infinity
        };
        channel.targets = levelStages.map(key => levelWidth(levels?.[key][index]?.peak ?? 0));
        channel.peak = peak;
        channel.pendingPeak = changedStage ? peak : Math.max(channel.pendingPeak, peak);
        channel.clippedAt = selected?.clippedAt ?? -Infinity;
        return channel;
    });
}

export function frame(state: DisplayState, time: number): { channels: readonly DisplayChannel[]; active: boolean } {
    advanceWidths(state, time);
    if (time >= state.nextReadout) {
        for (const channel of state.channels) {
            channel.readout = Math.max(channel.peak, channel.pendingPeak);
            channel.pendingPeak = 0;
        }
        state.nextReadout = time + readoutIntervalMs;
    }
    const channels = state.channels.map(channel => ({
        widths: [...channel.widths].sort((a, b) => b - a),
        peak: channel.readout,
        clipped: channel.clippedAt + clipHoldMs > time
    }));
    const active = state.channels.some((channel, index) =>
        channels[index].clipped
        || channel.widths.some((width, tap) => width !== channel.targets[tap])
        || Math.max(channel.peak, channel.pendingPeak) !== channel.readout);
    return { channels, active };
}