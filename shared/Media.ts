import { type AbsolutePath } from "./util/path";

export type MediaKind = "audio" | "video";

export type Media = {
    // Including the filename.
    path: AbsolutePath;
    hash: string;
    size: number;
    kind: MediaKind;
    duration: number;
    // Display name, defaults to filename.
    name: string;
};