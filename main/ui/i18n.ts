import { createI18n } from "../../shared/i18n";
import { type Locale } from "../../shared/locale";
import { defaultSettings } from "../../shared/settings/defaults";

const instance = createI18n(defaultSettings.language);

export function setLocale(language: Locale): void {
    // Bundled resources make language changes synchronous, including before a dialog opens.
    void instance.changeLanguage(language);
}

export const t = instance.t;