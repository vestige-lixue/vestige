import { type Settings } from "../../shared/settings/Settings";

type VolumeSliderSettings = Pick<Settings["playback"], "volumeSliderMapping" | "volumeSliderMinDb">;

export function volumeToSlider(volume: number, settings: VolumeSliderSettings): number {
    if (volume <= 0) return 0;
    if (settings.volumeSliderMapping === "amplitude") return Math.round(volume * 100);
    const gainDb = 20 * Math.log10(volume);
    return Math.round(Math.min(100, Math.max(1, 100 - gainDb / settings.volumeSliderMinDb * 99)));
}

export function sliderToVolume(position: number, settings: VolumeSliderSettings): number {
    if (position <= 0) return 0;
    if (settings.volumeSliderMapping === "amplitude") return position / 100;
    // Reserve 0% for mute; spread the finite dB range over positions 1% through 100%.
    const gainDb = (100 - position) / 99 * settings.volumeSliderMinDb;
    return 10 ** (gainDb / 20);
}