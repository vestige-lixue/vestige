// Root fields replace values. These sections merge direct fields only: palettes,
// presets and other nested values replace their previous value as a whole.
export const settingsSections = ["theme", "transcription", "editing", "volumeStabilization", "layout", "playback"] as const;