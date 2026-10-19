export type DownloadKind = "backend" | "model";

export type Download = {
    kind: DownloadKind;
    id: string;
    name: string;
    estimatedBytes: number;
    taskId: string | null;
    installed: boolean;
};

export const downloadChannels = {
    list: "downloads:list",
    start: "downloads:start",
    cancel: "downloads:cancel",
    openDirectory: "downloads:open-directory"
} as const;