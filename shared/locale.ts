export type Locale = "zh-CN" | "en";

export const defaultLocale: Locale = "zh-CN";

export function isLocale(value: unknown): value is Locale {
    return value === "zh-CN" || value === "en";
}