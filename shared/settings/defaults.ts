import { type Settings } from "./Settings";
import { settingsVersion } from "../constants";

export const defaultSettings = {
    version: settingsVersion,
    language: "zh-CN",
    compressProjectFiles: false,
    theme: {
        mode: "system",
        translucentSidebar: false,
        sidebarTransparency: 50,
        light: {
            "--c-accent": "#1e90ff",
            "--c-background": "#ffffff",
            "--c-surface": "#eef0f3",
            "--c-text": "#252a30",
            "--c-text-80p": "#686e75",
            "--c-audio-level": "#1eb961"
        },
        dark: {
            "--c-accent": "#58a6ff",
            "--c-background": "#161b22",
            "--c-surface": "#21262d",
            "--c-text": "#e6edf3",
            "--c-text-80p": "#919ba6",
            "--c-audio-level": "#219653"
        }
    },
    transcription: { concurrency: 1, presets: {} },
    editing: { spellcheck: false, fontSize: 16 },
    volumeStabilization: {
        maxGainDb: 30,
        gainAttackMs: 25,
        gainReleaseMs: 800,
        gateThresholdDb: -50,
        targetLevelDb: -15
    },
    window: { width: 800, height: 600, maximized: false },
    layout: { sidebarWidth: null, videoHeight: null },
    playback: { volumeSliderMapping: "amplitude", volumeSliderMinDb: -60, mediaSwitchPlayback: "pause", wordSwitchPlayback: "keep", rememberPlaybackPosition: true, pauseOnOutputDeviceChange: true, showLevelMeter: true, levelMeterReadout: "monitor", volumeStabilization: false, volume: 1, speed: 1, savedSpeed: null }
} as const satisfies Settings;