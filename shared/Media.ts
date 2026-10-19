import { type AbsolutePath } from "./util/path";

export type MediaKind = "audio" | "video";

export type Media = {
    id: string;
    // Including the filename.
    path: AbsolutePath;
    size: number;
    mtimeMs: number;
    kind: MediaKind;
    duration: number;
    // Display name, defaults to filename.
    name: string;
};