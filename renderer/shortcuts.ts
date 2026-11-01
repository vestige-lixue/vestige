export type Shortcut = { key: string; mod?: boolean; alt?: boolean; shift?: boolean };

export function formatShortcut(shortcut: Shortcut, mac: boolean): string {
    const key = shortcut.key.toLowerCase();
    const arrows: Record<string, string> = { arrowleft: "←", arrowright: "→", arrowup: "↑", arrowdown: "↓" };
    const names: Record<string, string> = mac
        ? { " ": "␣", enter: "↩", escape: "⎋", tab: "⇥", backspace: "⌫", delete: "⌦" }
        : { " ": "Space", enter: "Enter", escape: "Esc", tab: "Tab", backspace: "Backspace", delete: "Delete" };
    return [
        ...(shortcut.mod ? [mac ? "⌘" : "Ctrl"] : []),
        ...(shortcut.alt ? [mac ? "⌥" : "Alt"] : []),
        ...(shortcut.shift ? [mac ? "⇧" : "Shift"] : []),
        arrows[key] ?? names[key] ?? key.toUpperCase()
    ].join(mac ? "" : "+");
}