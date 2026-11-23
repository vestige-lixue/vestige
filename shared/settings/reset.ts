import { defaultSettings } from "./defaults";
import { type SettingsPatch } from "./Settings";

export function settingsResetPatch(): SettingsPatch {
    const { compressProjectFiles, mediaPathMode, transcription, editing, playback, theme, volumeStabilization } = defaultSettings;
    const {
        startRewindMs, rewindStepMs, volumeSliderMapping, volumeSliderMinDb,
        mediaSwitchPlayback, wordSwitchPlayback, rememberPlaybackPosition,
        pauseOnOutputDeviceChange, audioOffsetMs, showLevelMeter, levelMeterReadout
    } = playback;
    return structuredClone({
        compressProjectFiles, mediaPathMode,
        layout: { playerPosition: defaultSettings.layout.playerPosition },
        transcription: { concurrency: transcription.concurrency },
        editing: { ...editing },
        playback: {
            startRewindMs, rewindStepMs, volumeSliderMapping, volumeSliderMinDb,
            mediaSwitchPlayback, wordSwitchPlayback, rememberPlaybackPosition,
            pauseOnOutputDeviceChange, audioOffsetMs, showLevelMeter, levelMeterReadout
        },
        theme: { ...theme },
        volumeStabilization: { ...volumeStabilization }
    });
}