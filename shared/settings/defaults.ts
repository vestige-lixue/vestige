import { type Settings } from "./Settings";
import { settingsVersion } from "../constants";

export const defaultSettings = {
    version: settingsVersion,
    language: "zh-CN",
    compressProjectFiles: false,
    mediaPathMode: "project",
    theme: {
        mode: "system",
        translucentSidebar: false,
        sidebarTransparency: 50,
        light: {
            "--c-accent": "#1e90ff",
            "--c-background": "#ffffff",
            "--c-text": "#252a30"
        },
        dark: {
            "--c-accent": "#58a6ff",
            "--c-background": "#161b22",
            "--c-text": "#e6edf3"
        }
    },
    transcription: { concurrency: 2, presets: {}, lastConfig: null },
    export: { format: "txt", srt: { maxLineWidth: 42, maxLines: 2, pauseSeconds: 0.5, maxDurationSeconds: null, minDurationSeconds: 0.8, splitAtLineBreaks: true, splitAtSentenceEnds: true } },
    editing: { followPlayback: false, fontSize: 16, informationDisplay: "tooltip", hideTrivialInformation: false, referenceOverlap: 50, referenceTranscriptPosition: "right" },
    volumeStabilization: {
        maxGainDb: 30,
        gainAttackMs: 25,
        gainReleaseMs: 800,
        gateThresholdDb: -50,
        targetLevelDb: -15
    },
    window: { width: 800, height: 600, maximized: false },
    layout: { playerPosition: "top", sidebarWidth: null, videoHeight: null, showReferenceTranscript: false, referenceTranscriptRatio: 0.5 },
    playback: { mode: "single", volumeSliderMapping: "amplitude", volumeSliderMinDb: -60, mediaSwitchPlayback: "keep", wordSwitchPlayback: "keep", rewindStepMs: 2000, startRewindMs: 0, rememberPlaybackPosition: true, pauseOnOutputDeviceChange: true, audioOffsetMs: 0, showLevelMeter: true, levelMeterReadout: "source", volumeStabilization: false, volume: 1, speed: 1, savedSpeed: null }
} as const satisfies Settings;