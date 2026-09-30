export const projectChannels = {
    get: "project:get",
    save: "project:save",
    openDialog: "project:open-dialog",
    saveDialog: "project:save-dialog"
} as const;

export const appChannels = {
    beforeQuit: "app:before-quit",
    beforeQuitResult: "app:before-quit-result",
    openDevTools: "window:open-devtools"
} as const;