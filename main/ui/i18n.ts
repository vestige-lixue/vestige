import { createInstance } from "i18next";
import zhCN from "../../locales/zh-CN.json";
import en from "../../locales/en.json";
import { defaultLocale, type Locale } from "../../shared/locale";

const instance = createInstance();
void instance.init({
    resources: { "zh-CN": { translation: zhCN }, en: { translation: en } },
    lng: defaultLocale,
    fallbackLng: defaultLocale,
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