export type MediaKind = "audio" | "video";

export type Media = {
    // Including the filename.
    path: string;
    hash: string;
    size: number;
    kind: MediaKind;
    duration: number;
    // Display name, defaults to filename.
    name: string;
};