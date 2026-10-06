import { type Locale } from "../locale";
import { type Failure } from "../failure";
// Increment the format version when existing values need a migration. New fields
// with defaults and removed fields are handled by normalization within a version.
export type Config = {
    readonly version: 1;
    readonly language: Locale;
    readonly transcription: {
        readonly concurrency: number;
    };
    readonly window: {
        readonly width: number;
        readonly height: number;
        readonly maximized: boolean;
    };
    readonly layout: {
        // null retains the responsive default until the sidebar is resized.
        readonly sidebarWidth: number | null;
    };
    readonly playback: {
        readonly volumeStabilization: boolean;
        readonly volume: number;
        readonly speed: number;
        readonly savedSpeed: number | null;
    };
};

// Only settings editable in the settings dialog belong here. Layout and playback
// state use dedicated APIs; window state comes from BrowserWindow events.
export type ConfigPatch = Partial<Pick<Config, "language" | "transcription">>;

export type PlaybackConfigPatch = Partial<Config["playback"]>;

export type ConfigSnapshot = {
    readonly config: Config;
    readonly revision: number;
    readonly dirty: boolean;
    readonly saving: boolean;
    readonly error: Failure | null;
};

export type ConfigResult = ({
    success: true;
    snapshot: ConfigSnapshot;
} | {
    success: false;
    snapshot: ConfigSnapshot;
    error: Failure;
});