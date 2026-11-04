import { type BrowserWindow } from "electron";

export function revealWindow(window: BrowserWindow): void {
    if (window.isDestroyed() || window.isVisible() && !window.isMinimized()) return;
    if (window.isMinimized()) window.restore();
    if (!window.isVisible()) window.show();
    window.focus();
}