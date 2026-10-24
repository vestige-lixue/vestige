export const fileChannels = {
    normalize: "file:normalize",
    readMedia: "file:read-media",
    cancelMediaRead: "file:cancel-media-read",
    validationLoad: "file:validation-load",
    validationPlayback: "file:validation-playback",
    getMediaURL: "file:get-media-url",
    releaseMediaURL: "file:release-media-url",
    selectMediaPath: "file:select-media-path",
    selectMediaPaths: "file:select-media-paths",
    selectDirectory: "file:select-directory",
    listDirectories: "file:list-directories",
    openFFmpegDirectory: "file:open-ffmpeg-directory"
} as const;