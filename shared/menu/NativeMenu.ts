import { type Shortcut } from "../shortcuts";

export type NativeMenuItem =
    | { type: "separator" }
    | { type: "command"; id: string; label: string; enabled: boolean; shortcut: Shortcut | null }
    | { type: "edit"; id: string; label: string; enabled: boolean; shortcut: Shortcut }
    | { type: "quit"; label: string; shortcut: Shortcut }
    | { type: "system"; role: "services" | "hide" | "hideOthers" | "unhide" | "minimize" | "zoom" | "front"; label: string };

export type NativeMenu = { label: string; role?: "window" | "help"; items: NativeMenuItem[] };
export type NativeMenuState = { menus: NativeMenu[] };