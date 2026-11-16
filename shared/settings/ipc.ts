export const settingsChannels = {
    get: "settings:get",
    retryLoad: "settings:retry-load",
    backupAndReset: "settings:backup-and-reset",
    update: "settings:update",
    importFile: "settings:import-file",
    exportFile: "settings:export-file",
    replace: "settings:replace",
    flush: "settings:flush",
    changed: "settings:changed"
} as const;