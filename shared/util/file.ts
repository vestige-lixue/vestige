import { type Failure } from "../failure";
import { type AbsolutePath } from "./path";

// A native path from a file picker, or a File supplied by drag and drop.
export type InputSource = File | AbsolutePath;

export type FilePathResult = ({
    success: true;
    path: AbsolutePath;
} | {
    success: false;
    error: Failure;
});