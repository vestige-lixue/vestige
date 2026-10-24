import { type Settings, type SettingsPatch } from "./Settings";
import { settingsSections } from "./policy";

export function mergeSettings(base: Settings, patch: SettingsPatch): Settings;
export function mergeSettings(base: SettingsPatch, patch: SettingsPatch): SettingsPatch;
export function mergeSettings(base: Settings | SettingsPatch, patch: SettingsPatch): Settings | SettingsPatch {
    const result = { ...base, ...patch };
    for (const section of settingsSections) {
        if (patch[section] !== undefined) Object.assign(result, { [section]: { ...base[section], ...patch[section] } });
    }
    return result as Settings | SettingsPatch;
}