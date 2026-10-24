import { type ParseKeys, type TOptions } from "i18next";
import { createI18n } from "../shared/i18n";
import { locales, type Locale } from "../shared/locale";
import { defaultSettings } from "../shared/settings/defaults";
import * as settings from "./states/settings.svelte";

const instance = createI18n(defaultSettings.language);

// Track only the language, so unrelated settings updates do not invalidate every label.
const language = $derived(settings.getConfirmed()?.language ?? defaultSettings.language);

export function getLocale(): Locale {
    return language;
}

export function languageItems(): { value: Locale; label: string }[] {
    return locales.map(value => ({ value, label: t(`settings.general.language.options.${value}`) }));
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