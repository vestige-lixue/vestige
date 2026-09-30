import { argumentValue, modelPath, optionName } from "../parameters";

const fileOptions = new Set(["m", "model", "vm", "vad-model", "fp", "font-path"]);

export function nativeArguments(params: Record<string, unknown>, modelDirectory: string): string[] {
    const args: string[] = [];
    for (const [key, original] of Object.entries(params)) {
        const name = optionName(key);
        // Input and JSON destination belong to this API invocation.
        if (["f", "file", "of", "output-file"].includes(name)) {
            throw new Error("Option " + key + " is managed by Vestige; use mediaPath for the input.");
        }
        if (original === false) continue;
        const value = fileOptions.has(name) && typeof original === "string" && original
            ? modelPath(original, modelDirectory) : original;
        args.push(key.startsWith("-") ? key : "--" + key);
        if (value !== true) args.push(argumentValue(value));
    }
    return args;
}