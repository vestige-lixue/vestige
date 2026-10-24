import { createInstance, type i18n } from "i18next";
import zhCN from "../locales/zh-CN.json";
import en from "../locales/en.json";
import { locales, type Locale } from "./locale";

const resources = {
    "zh-CN": { translation: zhCN }, en: { translation: en }
} satisfies Record<Locale, { translation: typeof zhCN }>;

export function createI18n(defaultLanguage: Locale): i18n {
    const instance = createInstance();
    void instance.init({
        resources,
        lng: defaultLanguage,
        fallbackLng: defaultLanguage,
        supportedLngs: [...locales],
        initAsync: false,
        returnEmptyString: false,
        interpolation: { escapeValue: false }
    });
    return instance;
}