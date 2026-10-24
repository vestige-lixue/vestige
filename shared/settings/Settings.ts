import { type tags } from "typia";
import { type maxLayoutDimension, type settingsVersion, type minWindowWidth, type minWindowHeight, type minSidebarWidth, type maxSidebarWidth, type minEditorFontSize, type maxEditorFontSize, type minPlaybackSpeed, type maxPlaybackSpeed, type maxVolumeSliderMinDb, type minAudioOffsetMs, type maxAudioOffsetMs, type volumeStabilizationLimits } from "../constants";
import { type Locale } from "../locale";
import { type FailureInfo } from "../failure";
import { type ThemeSettings } from "../theme";
import { type Config, type Presets } from "../transcription/Config";
import { type MediaPathMode } from "../project/file";

import { type taskCapacity } from "../task";
import { type audioLevelStages, type playbackModes, type informationDisplays, type volumeSliderMappings, type switchPlaybackModes } from "./options";
import { type settingsSections } from "./policy";

type StabilizationLimits = typeof volumeStabilizationLimits;
type PlaybackSpeed = number & tags.Minimum<typeof minPlaybackSpeed> & tags.Maximum<typeof maxPlaybackSpeed>;

export type AudioLevelStage = typeof audioLevelStages[number];
export type PlaybackMode = typeof playbackModes[number];

export type VolumeStabilizationSettings = {
    readonly [Key in keyof StabilizationLimits]: number & tags.Minimum<StabilizationLimits[Key]["min"]> & tags.Maximum<StabilizationLimits[Key]["max"]>;
};

export type Settings = {
    readonly version: typeof settingsVersion;
    readonly language: Locale;
    readonly compressProjectFiles: boolean;
    readonly mediaPathMode: MediaPathMode;
    readonly theme: ThemeSettings;
    readonly transcription: {
        readonly concurrency: number & tags.Type<"uint64"> & tags.Minimum<1> & tags.Maximum<typeof taskCapacity>;
        readonly presets: Presets;
        readonly lastConfig: {
            readonly config: Config;
            readonly presetName: string;
        } | null;
    };
    readonly editing: {
        readonly spellcheck: boolean;
        readonly fontSize: number & tags.Minimum<typeof minEditorFontSize> & tags.Maximum<typeof maxEditorFontSize>;
        readonly informationDisplay: typeof informationDisplays[number];
    };
    readonly volumeStabilization: VolumeStabilizationSettings;
    readonly window: {
        readonly width: number & tags.Type<"uint32"> & tags.Minimum<typeof minWindowWidth> & tags.Maximum<typeof maxLayoutDimension>;
        readonly height: number & tags.Type<"uint32"> & tags.Minimum<typeof minWindowHeight> & tags.Maximum<typeof maxLayoutDimension>;
        readonly maximized: boolean;
    };
    readonly layout: {
        // null retains the responsive default until the sidebar is resized.
        readonly sidebarWidth: (number & tags.Minimum<typeof minSidebarWidth> & tags.Maximum<typeof maxSidebarWidth>) | null;
        // null uses the responsive default; viewport limits only affect the displayed height.
        readonly videoHeight: (number & tags.Minimum<0> & tags.Maximum<typeof maxLayoutDimension>) | null;
    };
    readonly playback: {
        readonly mode: PlaybackMode;
        readonly volumeSliderMapping: typeof volumeSliderMappings[number];
        readonly volumeSliderMinDb: number & tags.Maximum<typeof maxVolumeSliderMinDb>;
        readonly mediaSwitchPlayback: typeof switchPlaybackModes[number];
        readonly wordSwitchPlayback: typeof switchPlaybackModes[number];
        readonly rememberPlaybackPosition: boolean;
        readonly pauseOnOutputDeviceChange: boolean;
        readonly audioOffsetMs: number & tags.Type<"int32"> & tags.Minimum<typeof minAudioOffsetMs> & tags.Maximum<typeof maxAudioOffsetMs>;
        readonly showLevelMeter: boolean;
        readonly levelMeterReadout: AudioLevelStage;
        readonly volumeStabilization: boolean;
        readonly volume: number & tags.Minimum<0> & tags.Maximum<1>;
        readonly speed: PlaybackSpeed;
        readonly savedSpeed: PlaybackSpeed | null;
    };
};

// All renderer updates share this schema; window state comes from BrowserWindow events.
type EditableSettings = Omit<Settings, "version" | "window">;
export type SettingsPatch = {
    readonly [Key in keyof EditableSettings]?: Key extends "layout" ? {
        readonly sidebarWidth?: NonNullable<Settings["layout"]["sidebarWidth"]>;
        readonly videoHeight?: Settings["layout"]["videoHeight"];
    } : Key extends typeof settingsSections[number] ? Partial<EditableSettings[Key]> : EditableSettings[Key];
};

export type SettingsSnapshot = {
    readonly settings: Settings;
    readonly revision: number;
    readonly settingsRevision: number;
    readonly savedRevision: number;
    readonly dirty: boolean;
    readonly saving: boolean;
    readonly error: FailureInfo | null;
};

export type SettingsResult = ({
    success: true;
    snapshot: SettingsSnapshot;
} | {
    success: false;
    snapshot: SettingsSnapshot;
    error: FailureInfo;
});