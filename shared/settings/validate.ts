import typia from "typia";
import { type Settings, type VolumeStabilizationSettings } from "./Settings";
import { type Config, type Presets } from "../transcription/Config";

export const validLanguage = typia.createIs<Settings["language"]>();
export const validMediaPathMode = typia.createIs<Settings["mediaPathMode"]>();
const isSidebarTransparency = typia.createIs<Settings["theme"]["sidebarTransparency"]>();

export function validSidebarTransparency(value: unknown): value is Settings["theme"]["sidebarTransparency"] {
    return isSidebarTransparency(value) && Number.isFinite(value);
}

export const validConcurrency = typia.createIs<Settings["transcription"]["concurrency"]>();
export const validTranscriptionConfig = typia.createEquals<Config>();

export function validPresetNames(presets: Presets): boolean {
    return Object.keys(presets).every(name => name.trim().length > 0);
}

const isEditorFontSize = typia.createIs<Settings["editing"]["fontSize"]>();

export function validEditorFontSize(value: unknown): value is Settings["editing"]["fontSize"] {
    return isEditorFontSize(value) && Number.isFinite(value);
}

export const validVolumeSliderMapping = typia.createIs<Settings["playback"]["volumeSliderMapping"]>();
const isVolumeSliderMinDb = typia.createIs<Settings["playback"]["volumeSliderMinDb"]>();

export function validVolumeSliderMinDb(value: unknown): value is Settings["playback"]["volumeSliderMinDb"] {
    return isVolumeSliderMinDb(value) && Number.isFinite(value);
}

export const validMediaSwitchPlayback = typia.createIs<Settings["playback"]["mediaSwitchPlayback"]>();
export const validWordSwitchPlayback = typia.createIs<Settings["playback"]["wordSwitchPlayback"]>();
export const validLevelMeterReadout = typia.createIs<Settings["playback"]["levelMeterReadout"]>();

const volumeStabilizationValidators = {
    maxGainDb: typia.createIs<VolumeStabilizationSettings["maxGainDb"]>(),
    gainAttackMs: typia.createIs<VolumeStabilizationSettings["gainAttackMs"]>(),
    gainReleaseMs: typia.createIs<VolumeStabilizationSettings["gainReleaseMs"]>(),
    gateThresholdDb: typia.createIs<VolumeStabilizationSettings["gateThresholdDb"]>(),
    targetLevelDb: typia.createIs<VolumeStabilizationSettings["targetLevelDb"]>()
};

export function validVolumeStabilizationValue<Key extends keyof VolumeStabilizationSettings>(key: Key, value: unknown): value is VolumeStabilizationSettings[Key] {
    return volumeStabilizationValidators[key](value);
}