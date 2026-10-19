export function nativeArguments(params: Readonly<Record<string, string>>): string[] {
    return Object.entries(params).map(([key, value]) => value === "" ? key : `${key}=${value}`);
}