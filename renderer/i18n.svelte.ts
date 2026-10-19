import { createInstance, type ParseKeys, type TOptions } from "i18next";
import zhCN from "../locales/zh-CN.json";
import en from "../locales/en.json";
import { type Locale } from "../shared/locale";
import { defaultSettings } from "../shared/settings/defaults";
import * as settings from "./states/settings.svelte";

const instance = createInstance();
void instance.init({
    resources: { "zh-CN": { translation: zhCN }, en: { translation: en } },
    lng: defaultSettings.language,
    fallbackLng: defaultSettings.language,
    supportedLngs: ["zh-CN", "en"],
    initAsync: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false }
});

// Track only the language, so unrelated settings updates do not invalidate every label.
const language = $derived(settings.get()?.language ?? defaultSettings.language);

export function getLocale(): Locale {
    return language;
}

export function t(key: ParseKeys, options?: TOptions): string {
    // Pass the reactive locale on each call; never cache translated text in state.
    // Svelte escapes text and attributes; use html() for bundled translation markup.
    return instance.t(key, { ...options, lng: language });
}

export function html(key: ParseKeys, options?: TOptions): string {
    // Markup comes from the bundled translation catalog. Escape interpolated data separately.
    return instance.t(key, { ...options, lng: language, interpolation: { escapeValue: true } });
}