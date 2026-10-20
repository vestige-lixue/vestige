import { type tags } from "typia";
import { type settingsVersion, type minWindowWidth, type minWindowHeight, type minSidebarWidth, type maxSidebarWidth, type minEditorFontSize, type maxEditorFontSize, type minPlaybackSpeed, type maxPlaybackSpeed, type maxVolumeSliderMinDb, type volumeStabilizationLimits } from "../constants";
import { type Locale } from "../locale";
import { type FailureInfo } from "../failure";
import { type ThemeSettings } from "../theme";
import { type Presets } from "../transcription/Config";
import { type MediaPathMode } from "../project/file";

type StabilizationLimits = typeof volumeStabilizationLimits;
type PlaybackSpeed = number & tags.Minimum<typeof minPlaybackSpeed> & tags.Maximum<typeof maxPlaybackSpeed>;

export type AudioLevelStage = "source" | "project" | "monitor";

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
        readonly concurrency: number & tags.Type<"uint64"> & tags.Minimum<1> & tags.Maximum<9007199254740991>;
        readonly presets: Presets;
    };
    readonly editing: {
        readonly spellcheck: boolean;
        readonly fontSize: number & tags.Minimum<typeof minEditorFontSize> & tags.Maximum<typeof maxEditorFontSize>;
    };
    readonly volumeStabilization: VolumeStabilizationSettings;
    readonly window: {
        readonly width: number & tags.Type<"uint32"> & tags.Minimum<typeof minWindowWidth> & tags.Maximum<2147483647>;
        readonly height: number & tags.Type<"uint32"> & tags.Minimum<typeof minWindowHeight> & tags.Maximum<2147483647>;
        readonly maximized: boolean;
    };
    readonly layout: {
        // null retains the responsive default until the sidebar is resized.
        readonly sidebarWidth: (number & tags.Minimum<typeof minSidebarWidth> & tags.Maximum<typeof maxSidebarWidth>) | null;
        // null uses the responsive default; viewport limits only affect the displayed height.
        readonly videoHeight: (number & tags.Minimum<0> & tags.Maximum<2147483647>) | null;
    };
    readonly playback: {
        readonly volumeSliderMapping: "amplitude" | "decibel";
        readonly volumeSliderMinDb: number & tags.Maximum<typeof maxVolumeSliderMinDb>;
        readonly mediaSwitchPlayback: "pause" | "play" | "keep" | "invert";
        readonly wordSwitchPlayback: "pause" | "play" | "keep" | "invert";
        readonly rememberPlaybackPosition: boolean;
        readonly pauseOnOutputDeviceChange: boolean;
        readonly showLevelMeter: boolean;
        readonly levelMeterReadout: AudioLevelStage;
        readonly volumeStabilization: boolean;
        readonly volume: number & tags.Minimum<0> & tags.Maximum<1>;
        readonly speed: PlaybackSpeed;
        readonly savedSpeed: PlaybackSpeed | null;
    };
};

// All renderer updates share this schema; window state comes from BrowserWindow events.
export type SettingsPatch = {
    readonly language?: Settings["language"];
    readonly compressProjectFiles?: Settings["compressProjectFiles"];
    readonly mediaPathMode?: Settings["mediaPathMode"];
    readonly theme?: Partial<ThemeSettings>;
    readonly transcription?: Partial<Settings["transcription"]>;
    readonly editing?: Partial<Settings["editing"]>;
    readonly volumeStabilization?: Partial<VolumeStabilizationSettings>;
    readonly layout?: {
        readonly sidebarWidth?: NonNullable<Settings["layout"]["sidebarWidth"]>;
        readonly videoHeight?: Settings["layout"]["videoHeight"];
    };
    readonly playback?: Partial<Settings["playback"]>;
};

export type SettingsSnapshot = {
    readonly settings: Settings;
    readonly revision: number;
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