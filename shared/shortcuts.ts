export type Shortcut = { key: string; mod?: boolean; alt?: boolean; shift?: boolean };

export type ShortcutInput = { key: string; meta: boolean; control: boolean; alt: boolean; shift: boolean };

export function macAccelerator(shortcut: Shortcut): string {
    const key = shortcut.key.toLowerCase();
    const names: Record<string, string> = { " ": "Space", arrowleft: "Left", arrowright: "Right", arrowup: "Up", arrowdown: "Down" };
    return [
        ...(shortcut.mod ? ["Command"] : []),
        ...(shortcut.alt ? ["Alt"] : []),
        ...(shortcut.shift ? ["Shift"] : []),
        names[key] ?? (key.length === 1 ? key.toUpperCase() : shortcut.key)
    ].join("+");
}

export function matchesMacShortcut(shortcut: Shortcut, input: ShortcutInput): boolean {
    return shortcut.key.toLowerCase() === input.key.toLowerCase() && !!shortcut.mod === (input.meta && !input.control)
        && !!shortcut.alt === input.alt && !!shortcut.shift === input.shift
        && (!!shortcut.mod || !input.control && !input.meta);
}