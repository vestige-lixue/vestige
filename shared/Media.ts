import { type AbsolutePath } from "./util/path";

export type MediaKind = "audio" | "video";

export type Media = {
    id: string;
    // Including the filename.
    path: AbsolutePath;
    size: number;
    // XXH3_64bits with seed 0, stored as 16 lowercase hexadecimal digits.
    hash: string;
    kind: MediaKind;
    duration: number;
    // Display name, defaults to filename.
    name: string;
};