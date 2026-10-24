import typia from "typia";
import { VestigeErrors } from "../../shared/failure";
import { type Settings, type SettingsPatch } from "../../shared/settings/Settings";
import { type settingsSections } from "../../shared/settings/policy";
import { validEditorFontSize, validSidebarTransparency, validVolumeSliderMinDb, validPresetNames } from "../../shared/settings/validate";

// Keep public patches composable while requiring at least one field at the IPC boundary.
type NonEmptyPatch<T> = {
    [Key in keyof T]-?: Required<Pick<T, Key>> & Partial<Omit<T, Key>>;
}[keyof T];

type ValidatedSettingsPatch = NonEmptyPatch<{
    [Key in keyof SettingsPatch]: Key extends typeof settingsSections[number]
        ? NonEmptyPatch<NonNullable<SettingsPatch[Key]>> : SettingsPatch[Key];
}>;

// Optional TS properties allow undefined; persisted settings require defined values at every level.
// Both typia plugins disable the default tolerance for undefined index-signature values.
type DefinedSettingsValues = { [key: string]: string | number | boolean | null | DefinedSettingsValues };

export function validSettings(value: unknown): value is Settings {
    return typia.equals<Settings>(value) && typia.is<DefinedSettingsValues>(value)
        && validEditorFontSize(value.editing.fontSize)
        && validVolumeSliderMinDb(value.playback.volumeSliderMinDb)
        && validSidebarTransparency(value.theme.sidebarTransparency)
        && validPresetNames(value.transcription.presets);
}

export const validWindowSettings = typia.createEquals<Settings["window"]>();

export function validatePatch(value: unknown): SettingsPatch {
    if (!typia.equals<ValidatedSettingsPatch>(value) || !typia.is<DefinedSettingsValues>(value)) {
        throw new VestigeErrors({ kind: "settings-invalid-update" });
    }
    if (value.editing?.fontSize !== undefined && !validEditorFontSize(value.editing.fontSize)) {
        throw new VestigeErrors({ kind: "settings-invalid-update" });
    }
    if (value.playback?.volumeSliderMinDb !== undefined && !validVolumeSliderMinDb(value.playback.volumeSliderMinDb)) {
        throw new VestigeErrors({ kind: "settings-invalid-update" });
    }
    if (value.theme?.sidebarTransparency !== undefined && !validSidebarTransparency(value.theme.sidebarTransparency)) {
        throw new VestigeErrors({ kind: "settings-invalid-update" });
    }
    if (value.transcription?.presets && !validPresetNames(value.transcription.presets)) {
        throw new VestigeErrors({ kind: "settings-invalid-update" });
    }
    return value;
}