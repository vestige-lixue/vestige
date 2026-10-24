export const settingsChannels = {
    get: "settings:get",
    update: "settings:update",
    save: "settings:save",
    changed: "settings:changed"
} as const;

export const fileChannels = {
    normalize: "file:normalize",
    readMedia: "file:read-media",
    cancelMediaRead: "file:cancel-media-read",
    getMediaURL: "file:get-media-url",
    releaseMediaURL: "file:release-media-url",
    selectMediaPath: "file:select-media-path",
    selectMediaPaths: "file:select-media-paths",
    selectDirectory: "file:select-directory",
    listDirectories: "file:list-directories",
    openFFmpegDirectory: "file:open-ffmpeg-directory"
} as const;

export const projectChannels = {
    get: "project:get",
    checkFile: "project:check-file",
    save: "project:save",
    openDialog: "project:open-dialog",
    saveDialog: "project:save-dialog"
} as const;

export const appChannels = {
    ready: "app:ready",
    quit: "app:quit",
    edit: "app:edit",
    clearLogs: "app:clear-logs",
    beforeQuit: "app:before-quit",
    beforeQuitResult: "app:before-quit-result",
    openDevTools: "window:open-devtools",
    supportsMica: "window:supports-mica"
} as const;