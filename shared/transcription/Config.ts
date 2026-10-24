import { type Executor } from "./executor";

export type Config = {
    readonly executor: Executor;
    // Select a backend before transcription. Relative paths are under the user's backends folder.
    readonly backendDirectory: string;
    readonly modelDirectory: string;
    readonly params: Readonly<Record<string, string>>;
};

export type Presets = Readonly<Record<string, Config>>;

export function defaultConfig(): Config {
    return { executor: "whisper.cpp", backendDirectory: "", modelDirectory: "", params: {} };
}

export function configsEqual(left: Config, right: Config): boolean {
    return left.executor === right.executor
        && left.backendDirectory === right.backendDirectory
        && left.modelDirectory === right.modelDirectory
        && Object.keys(left.params).length === Object.keys(right.params).length
        && Object.entries(left.params).every(([key, value]) => Object.hasOwn(right.params, key) && right.params[key] === value);
}