// A lexically normalized, fully qualified path in its platform's native syntax.
// The file need not exist; this does not establish filesystem identity.
export type AbsolutePath = string & {
    readonly __absolutePathBrand: never;
};

export function getFileName(path: AbsolutePath): string {
    // POSIX absolute paths start with '/'; normalized Windows paths use '\'.
    // A backslash in a POSIX filename must remain part of the filename.
    const separator = path.startsWith("/") ? "/" : "\\";
    return path.slice(path.lastIndexOf(separator) + 1);
}