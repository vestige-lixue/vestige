import { type Executer } from "./executer";

export type Config = {
    readonly executer: Executer;
    // Select a backend before transcription. Relative paths are under the user's backends folder.
    readonly backendDirectory: string;
    readonly modelDirectory: string;
    readonly params: Readonly<Record<string, string>>;
};

export type Presets = Readonly<Record<string, Config>>;

export function defaultConfig(): Config {
    return { executer: "whisper.cpp", backendDirectory: "", modelDirectory: "", params: {} };
}