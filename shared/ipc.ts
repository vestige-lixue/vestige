export const fileChannels = {
    normalize: "file:normalize",
    readMedia: "file:read-media",
    cancelMediaRead: "file:cancel-media-read",
    openMediaSource: "file:open-media-source",
    closeMediaSource: "file:close-media-source",
    selectMediaPath: "file:select-media-path",
    selectMediaPaths: "file:select-media-paths"
} as const;

export const projectChannels = {
    get: "project:get",
    save: "project:save",
    openDialog: "project:open-dialog",
    saveDialog: "project:save-dialog"
} as const;

export const appChannels = {
    quit: "app:quit",
    edit: "app:edit",
    beforeQuit: "app:before-quit",
    beforeQuitResult: "app:before-quit-result",
    openDevTools: "window:open-devtools"
} as const;