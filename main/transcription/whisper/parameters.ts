import { VestigeErrors } from "../../../shared/failure";

export function nativeArguments(params: Readonly<Record<string, string>>): string[] {
    const args: string[] = [];
    for (const [key, value] of Object.entries(params)) {
        if (["-f", "--file", "-of", "--output-file", "-m", "--model"].includes(key)) {
            throw new VestigeErrors({ kind: "transcription-managed-option", option: key });
        }
        args.push(key);
        if (value !== "") args.push(value);
    }
    return args;
}