import * as settings from "./states/settings.svelte";
import { defaultSettings } from "../shared/settings/defaults";
import { resolveTheme, resolveThemeScheme, themeColorKeys } from "../shared/theme";

export async function initialize(): Promise<() => void> {
    const micaSupported = await window.api.supportsMica().catch(error => {
        console.error(error);
        return false;
    });
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (): void => {
        const theme = settings.get()?.theme ?? defaultSettings.theme;
        const scheme = resolveThemeScheme(theme.mode, systemTheme.matches);
        const colors = resolveTheme(scheme, theme[scheme]);
        const root = document.documentElement;
        for (const key of themeColorKeys) {
            if (root.style.getPropertyValue(key) !== colors[key]) root.style.setProperty(key, colors[key]);
        }
        root.style.colorScheme = scheme;
        root.dataset.theme = scheme;
        const mica = micaSupported && theme.translucentSidebar;
        root.classList.toggle("mica", mica);
        if (mica) root.style.setProperty("--sidebar-transparency", `${theme.sidebarTransparency}%`);
        else root.style.removeProperty("--sidebar-transparency");
    };
    const unsubscribe = settings.subscribe(apply);
    systemTheme.addEventListener("change", apply);
    return () => {
        unsubscribe();
        systemTheme.removeEventListener("change", apply);
    };
}