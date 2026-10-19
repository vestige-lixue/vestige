export type Locale = "zh-CN" | "en";

export function isLocale(value: unknown): value is Locale {
    return value === "zh-CN" || value === "en";
}