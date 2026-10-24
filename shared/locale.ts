export const localeDefinitions = {
    "zh-CN": { documentSuffix: "zh-cn" },
    en: { documentSuffix: "en" }
} as const;

export type Locale = keyof typeof localeDefinitions;
export const locales: readonly Locale[] = Object.keys(localeDefinitions) as Locale[];

export function isLocale(value: unknown): value is Locale {
    return typeof value === "string" && Object.hasOwn(localeDefinitions, value);
}