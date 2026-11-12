import { type tags } from "typia";
import { defaultSettings } from "./settings/defaults";

export const themeModes = ["light", "system", "dark"] as const;
export const themeSchemes = ["light", "dark"] as const;
export const themeColorKeys = ["--c-accent", "--c-background", "--c-text"] as const;

export type ThemeScheme = typeof themeSchemes[number];
export type ThemeMode = typeof themeModes[number];
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
    return themeModes.some(mode => mode === value);
}

export function resolveThemeScheme(mode: ThemeMode, systemDark: boolean): ThemeScheme {
    return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

export function resolveTheme(scheme: ThemeScheme, overrides: ThemeOverrides): ThemeColors {
    return { ...defaultSettings.theme[scheme], ...overrides };
}

type Rgb = readonly [number, number, number];
type Oklab = { lightness: number; a: number; b: number };
type DerivedColorKey = "--c-surface" | "--c-border" | "--c-border-strong" | "--c-audio-level"
    | "--c-scrollbar" | "--c-shadow-1" | "--c-shadow-2" | "--c-shadow-3" | "--interaction-rgb";

function rgbBytes(hex: ThemeColor): Rgb {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function linearChannel(byte: number): number {
    const channel = byte / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function decodeSrgb([r, g, b]: Rgb): Rgb {
    return [linearChannel(r), linearChannel(g), linearChannel(b)];
}

// Matrices for linear sRGB and Oklab: https://bottosson.github.io/posts/oklab/#implementation
function toOklab([r, g, b]: Rgb): Oklab {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return {
        lightness: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    };
}

function linearRgb(lightness: number, a: number, b: number): Rgb {
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
}

function inGamut(rgb: Rgb): boolean {
    return rgb.every(channel => channel >= -1e-6 && channel <= 1 + 1e-6);
}

function srgbByte(linear: number): number {
    const channel = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, channel)) * 255);
}

function rgbAtLightness({ a, b }: Oklab, lightness: number): Rgb {
    let rgb = linearRgb(lightness, a, b);
    if (!inGamut(rgb)) {
        // The requested lightness can put a saturated background outside sRGB.
        // Keep its hue and find the greatest chroma that still fits.
        let low = 0, high = 1;
        for (let i = 0; i < 16; i++) {
            const scale = (low + high) / 2;
            if (inGamut(linearRgb(lightness, a * scale, b * scale))) low = scale;
            else high = scale;
        }
        rgb = linearRgb(lightness, a * low, b * low);
    }
    return [srgbByte(rgb[0]), srgbByte(rgb[1]), srgbByte(rgb[2])];
}

function hexColor(rgb: Rgb): string {
    return `#${rgb.map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance([r, g, b]: Rgb): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function audioLevelColor(background: Rgb, text: Rgb): string {
    const luminance = relativeLuminance(background);
    const brighter = relativeLuminance(text) > luminance;
    const greenCoefficient = 1.3471839;
    let green = brighter
        ? Math.min(0.4, (luminance + 0.05) * 4.57 - 0.05)
        : Math.max(0, (luminance + 0.05) / 2.57 - 0.05);
    if (brighter && (green + 0.05) / (luminance + 0.05) < 2.57) {
        // The 2.57 target keeps green above the background until its fixed-chromaticity sRGB ceiling.
        // A background above that ceiling can still be brighter than the capped green.
        green = Math.min((luminance + 0.05) * 2.57 - 0.05, 1 / greenCoefficient);
    }
    // XYZ D65 (0.567, 1, 0.5) in linear sRGB. Scaling by Y preserves its green chromaticity.
    return hexColor([srgbByte(0.0509414 * green), srgbByte(greenCoefficient * green), srgbByte(0.3560511 * green)]);
}

export function deriveThemeColors(colors: ThemeColors): Record<DerivedColorKey, string> {
    const linearBackground = decodeSrgb(rgbBytes(colors["--c-background"]));
    const text = rgbBytes(colors["--c-text"]);
    const linearText = decodeSrgb(text);
    const background = toOklab(linearBackground);
    const distance = toOklab(linearText).lightness - background.lightness;
    // Interpolate the original palette steps between the two default background lightnesses.
    const darkLightness = 0.2202;
    const weight = Math.max(0, Math.min(1, (background.lightness - darkLightness) / (1 - darkLightness)));
    const interpolate = (dark: number, light: number): number => dark + (light - dark) * weight;
    const tone = (dark: number, light: number): string => {
        const step = interpolate(dark, light);
        const lightness = background.lightness + Math.max(-step, Math.min(step, distance));
        return hexColor(rgbAtLightness(background, lightness));
    };
    const shadowRgb = rgbAtLightness(background, 0.28 * weight).join(" ");
    const shadow = (dark: number, light: number): string => `rgb(${shadowRgb} / ${Number(interpolate(dark, light).toFixed(3))})`;
    return {
        "--c-surface": tone(0.0464, 0.0455),
        "--c-border": tone(0.121, 0.082),
        "--c-border-strong": tone(0.225, 0.148),
        "--c-audio-level": audioLevelColor(linearBackground, linearText),
        "--c-scrollbar": tone(0.393, 0.400),
        "--c-shadow-1": shadow(0.18, 0.06),
        "--c-shadow-2": shadow(0.28, 0.08),
        "--c-shadow-3": shadow(0.4, 0.12),
        "--interaction-rgb": text.join(" ")
    };
}