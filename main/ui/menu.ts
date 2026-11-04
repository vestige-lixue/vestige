import { app, Menu, type BrowserWindow, type Input, type MenuItemConstructorOptions, type WebContents } from "electron";
import typia from "typia";
import { type NativeMenuItem, type NativeMenuState } from "../../shared/menu/NativeMenu";
import { menuChannels } from "../../shared/ipc";
import { macAccelerator, matchesMacShortcut, type Shortcut } from "../../shared/shortcuts";
import { listen } from "../util/ipc";
import { t } from "./i18n";
import { revealWindow } from "./visibility";

const shortcuts = new WeakMap<WebContents, Shortcut[]>();

export function ignoreMenuShortcut(contents: WebContents, input: Input): boolean {
    return shortcuts.get(contents)?.some(shortcut => matchesMacShortcut(shortcut, input)) ?? false;
}

export function initializeApplicationMenu(): void {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{
        label: app.name,
        submenu: [
            { role: "hide", label: t("menu.system.hide") },
            { role: "hideOthers", label: t("menu.system.hideOthers") },
            { role: "unhide", label: t("menu.system.unhide") },
            { type: "separator" },
            { label: t("menu.other.quit"), accelerator: "Command+Q", click: () => app.quit() }
        ]
    }]));
}

export function registerMenuIPCs(window: BrowserWindow): void {
    const contents = window.webContents;
    let menu: Menu | null = null;
    let structure = "";

    function itemOptions(item: NativeMenuItem): MenuItemConstructorOptions {
        if (item.type === "separator") return { type: "separator" };
        if (item.type === "system") return { role: item.role, label: item.label };
        if (item.type === "quit") return { label: item.label, accelerator: macAccelerator(item.shortcut), click: () => app.quit() };
        return {
            id: item.id, label: item.label, enabled: item.enabled,
            accelerator: item.shortcut ? macAccelerator(item.shortcut) : undefined,
            click: () => {
                if (window.isDestroyed() || contents.isDestroyed()) return;
                revealWindow(window);
                window.focus();
                contents.send(menuChannels.command, item.id);
            }
        };
    }

    listen(contents, menuChannels.update, (value: unknown) => {
        const validation = typia.validate<NativeMenuState>(value);
        if (!validation.success) {
            console.warn("Invalid native menu state", validation.errors);
            return;
        }
        const state = validation.data;
        shortcuts.set(contents, state.menus.flatMap(group => group.items.flatMap(item => item.type === "command" && item.shortcut ? [item.shortcut] : [])));
        const nextStructure = JSON.stringify(state, (key, value) => key === "enabled" ? undefined : value);
        if (menu && structure === nextStructure) {
            for (const group of state.menus) for (const item of group.items) {
                if (item.type !== "command" && item.type !== "edit") continue;
                const nativeItem = menu.getMenuItemById(item.id);
                if (nativeItem) nativeItem.enabled = item.enabled;
            }
            return;
        }
        menu = Menu.buildFromTemplate(state.menus.map(group => ({ label: group.label, role: group.role, submenu: group.items.map(itemOptions) })));
        structure = nextStructure;
        Menu.setApplicationMenu(menu);
    });
    listen(contents, menuChannels.documentEdited, (edited: unknown) => {
        if (typeof edited === "boolean") window.setDocumentEdited(edited);
    });

    function reset(): void {
        shortcuts.delete(contents);
        menu = null;
        structure = "";
        initializeApplicationMenu();
    }
    contents.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => {
        if (mainFrame && !inPlace) reset();
    });
    contents.on("render-process-gone", reset);
    contents.once("destroyed", reset);
}