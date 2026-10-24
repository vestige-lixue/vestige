import { type AudioLevelStage } from "../../shared/settings/Settings";

import { audioLevelStages as levelStages } from "../../shared/settings/options";
export { audioLevelStages as levelStages } from "../../shared/settings/options";
export const clipHoldMs = 1500;

export type AudioLevel = {
    readonly peak: number;
    readonly clippedAt: number;
};

export type AudioLevels = Readonly<Record<AudioLevelStage, readonly AudioLevel[]>>;

export type LevelMessage = {
    readonly generation: number;
    readonly time: number;
    readonly peaks: number[][];
    readonly clipAges: number[][];
};

export function readLevels(message: LevelMessage, previous: AudioLevels | null, now: number, audioTime: number): AudioLevels {
    const delay = Math.max(0, audioTime - message.time) * 1000;
    const levels: Record<AudioLevelStage, AudioLevel[]> = { source: [], project: [], monitor: [] };
    for (const [index, stage] of levelStages.entries()) {
        levels[stage] = message.peaks[index].map((peak, channel) => {
            const age = message.clipAges[index][channel];
            return { peak, clippedAt: age >= 0 ? now - delay - age : previous?.[stage][channel]?.clippedAt ?? -Infinity };
        });
    }
    return levels;
}

export function silenceLevels(levels: AudioLevels | null): AudioLevels | null {
    if (!levels) return null;
    const silence = (level: AudioLevel): AudioLevel => ({ ...level, peak: 0 });
    return { source: levels.source.map(silence), project: levels.project.map(silence), monitor: levels.monitor.map(silence) };
}

export function levelDb(peak: number): number {
    return peak > 0 && Number.isFinite(peak) ? 20 * Math.log10(peak) : -Infinity;
}

export function levelWidth(peak: number): number {
    return Math.max(0, Math.min(100, (levelDb(peak) + 60) / 60 * 100));
}

export function levelText(peak: number): string {
    const db = levelDb(peak);
    return Number.isFinite(db) ? db.toFixed(1).replace("-", "−") : "−∞";
}