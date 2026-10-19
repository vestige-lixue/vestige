import { createInstance } from "i18next";
import zhCN from "../../locales/zh-CN.json";
import en from "../../locales/en.json";
import { type Locale } from "../../shared/locale";
import { defaultSettings } from "../../shared/settings/defaults";

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

export function setLocale(language: Locale): void {
    // Bundled resources make language changes synchronous, including before a dialog opens.
    void instance.changeLanguage(language);
}

export const t = instance.t;