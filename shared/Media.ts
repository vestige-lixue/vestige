import { type tags } from "typia";
import { type AbsolutePath } from "./util/path";
import { type NonNegativeInteger, type NonNegativeNumber } from "./util/Scalar";

export type MediaKind = "audio" | "video";
export type MediaId = string & tags.Pattern<"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"> & tags.MaxLength<36>;
export type MediaHash = string & tags.Pattern<"^[0-9a-f]{16}$"> & tags.MaxLength<16>;

export type Media = {
    id: MediaId;
    // Including the filename.
    path: AbsolutePath;
    size: NonNegativeInteger;
    // XXH3_64bits with seed 0, stored as 16 lowercase hexadecimal digits.
    hash: MediaHash;
    kind: MediaKind;
    duration: NonNegativeNumber;
    // Display name, defaults to filename.
    name: string;
};