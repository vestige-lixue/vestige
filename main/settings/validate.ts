import typia from "typia";
import { checkVersion, structureError } from "../util/data";
import { VestigeErrors, isExpectedFailure } from "../../shared/failure";
import { type Settings, type SettingsPatch } from "../../shared/settings/Settings";
import { settingsVersion } from "../../shared/constants";
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

export function parseSettings(value: unknown): Settings {
    checkVersion("settings", value, settingsVersion);
    const checked = typia.assertEquals<Settings>(value, props => structureError("settings", props));
    const invalid = (path: string, expected: string): never => {
        throw new VestigeErrors({ kind: "invalid-structure", path: `settings.${path}`, expected });
    };
    if (!validEditorFontSize(checked.editing.fontSize)) invalid("editing.fontSize", "a valid editor font size");
    if (!validVolumeSliderMinDb(checked.playback.volumeSliderMinDb)) invalid("playback.volumeSliderMinDb", "a finite volume slider minimum in decibels");
    if (!validSidebarTransparency(checked.theme.sidebarTransparency)) invalid("theme.sidebarTransparency", "a valid sidebar transparency");
    if (!validPresetNames(checked.transcription.presets)) invalid("transcription.presets", "preset names that are not blank");
    return checked;
}

export function validSettings(value: unknown): value is Settings {
    if (!typia.is<DefinedSettingsValues>(value)) return false;
    try {
        parseSettings(value);
        return true;
    }
    catch (error) {
        if (!isExpectedFailure(error)) throw error;
        return false;
    }
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