export type HslaColor = {
    readonly h: number; // 0–360 degrees
    readonly s: number; // 0–100 percent
    readonly l: number; // 0–100 percent
    readonly a: number; // 0–1
};

function clamp(value: number, max: number, fallback = 0): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
}

export function normalizeHsla(value: HslaColor): HslaColor {
    return { h: clamp(value.h, 360), s: clamp(value.s, 100), l: clamp(value.l, 100), a: clamp(value.a, 1, 1) };
}

export function hslaToCss(value: HslaColor): string {
    const { h, s, l, a } = normalizeHsla(value);
    return `hsl(${h} ${s}% ${l}% / ${a})`;
}

export function hslaToHex(value: HslaColor, alpha = true): string {
    const { h, s, l, a } = normalizeHsla(value);
    const lightness = l / 100;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * s / 100;
    const sector = h / 60;
    const secondary = chroma * (1 - Math.abs(sector % 2 - 1));
    const channels = sector < 1 ? [chroma, secondary, 0] : sector < 2 ? [secondary, chroma, 0]
        : sector < 3 ? [0, chroma, secondary] : sector < 4 ? [0, secondary, chroma]
        : sector < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
    const offset = lightness - chroma / 2;
    const byte = (value: number): string => Math.round(value * 255).toString(16).padStart(2, "0");
    return `#${channels.map(channel => byte(channel + offset)).join("")}${alpha ? byte(a) : ""}`;
}

export function hexToHsla(value: string): HslaColor | null {
    const hex = value.trim();
    if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
    const digits = hex.length <= 5 ? [...hex.slice(1)].map(digit => digit + digit).join("") : hex.slice(1);
    const [r, g, b] = [0, 2, 4].map(offset => parseInt(digits.slice(offset, offset + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), chroma = max - min;
    const l = (max + min) / 2;
    const sector = chroma === 0 ? 0 : max === r ? (g - b) / chroma : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
    return {
        h: (sector * 60 + 360) % 360,
        s: chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * l - 1)) * 100,
        l: l * 100,
        a: digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1
    };
}