import { type Shortcut } from "../shared/shortcuts";

export function formatShortcut(shortcut: Shortcut, mac: boolean): string {
    const key = shortcut.key.toLowerCase();
    const arrows: Record<string, string> = { arrowleft: "←", arrowright: "→", arrowup: "↑", arrowdown: "↓" };
    const names: Record<string, string> = mac
        ? { " ": "␣", enter: "↩", escape: "⎋", tab: "⇥", backspace: "⌫", delete: "⌦" }
        : { " ": "Space", enter: "Enter", escape: "Esc", tab: "Tab", backspace: "Backspace", delete: "Delete" };
    const modifiers = mac ? [
        ...shortcut.alt ? ["⌥"] : [], ...shortcut.shift ? ["⇧"] : [], ...shortcut.mod ? ["⌘"] : []
    ] : [
        ...shortcut.mod ? ["Ctrl"] : [], ...shortcut.alt ? ["Alt"] : [], ...shortcut.shift ? ["Shift"] : []
    ];
    return [...modifiers, arrows[key] ?? names[key] ?? key.toUpperCase()].join(mac ? "" : "+");
}