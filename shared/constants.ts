export const settingsVersion = 1;
export const minWindowWidth = 640;
export const minWindowHeight = 480;
export const minSidebarWidth = 150;
export const maxSidebarWidth = 750;
export const minEditorFontSize = 4;
export const maxEditorFontSize = 48;
export const minPlaybackSpeed = 0.2;
export const maxPlaybackSpeed = 3;
export const maxVolumeSliderMinDb = -10;
export const minAudioOffsetMs = -3000;
export const maxAudioOffsetMs = 3000;

export const volumeStabilizationLimits = {
    maxGainDb: { min: 0, max: 36 },
    gainAttackMs: { min: 1, max: 1000 },
    gainReleaseMs: { min: 10, max: 10000 },
    gateThresholdDb: { min: -90, max: -20 },
    targetLevelDb: { min: -36, max: -6 }
} as const;