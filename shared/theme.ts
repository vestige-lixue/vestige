import { type tags } from "typia";
import { defaultSettings } from "./settings/defaults";

export const themeSchemes = ["light", "dark"] as const;
export const themeColorKeys = ["--c-accent", "--c-background", "--c-surface", "--c-text", "--c-text-80p", "--c-audio-level"] as const;

export type ThemeScheme = typeof themeSchemes[number];
export type ThemeMode = "system" | ThemeScheme;
export type ThemeColorKey = typeof themeColorKeys[number];
export type ThemeColor = string & tags.Pattern<"^#[0-9a-f]{6}$">;
export type ThemeColors = { readonly [Key in ThemeColorKey]: ThemeColor };
export type ThemeOverrides = Partial<ThemeColors>;
export type ThemeSettings = {
    readonly mode: ThemeMode;
    readonly translucentSidebar: boolean;
    readonly sidebarTransparency: number & tags.Minimum<0> & tags.Maximum<100>;
    readonly light: ThemeOverrides;
    readonly dark: ThemeOverrides;
};

export function validThemeMode(value: unknown): value is ThemeMode {
    return value === "system" || value === "light" || value === "dark";
}

export function resolveThemeScheme(mode: ThemeMode, systemDark: boolean): ThemeScheme {
    return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

export function resolveTheme(scheme: ThemeScheme, overrides: ThemeOverrides): ThemeColors {
    return { ...defaultSettings.theme[scheme], ...overrides };
}