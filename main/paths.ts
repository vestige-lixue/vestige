import { join } from "node:path";
import { type AbsolutePath } from "../shared/util/path";
import { parseAbsolutePath } from "./util/file";

export type AppPaths = Readonly<{
    dataDirectory: AbsolutePath;
    sessionDirectory: AbsolutePath;
    logsDirectory: AbsolutePath;
    resourcesDirectory: AbsolutePath;
    // Tools shipped with the application, separate from downloaded CUDA runtimes.
    runtimeDirectory: AbsolutePath;
    runtimeCacheDirectory: AbsolutePath;
    modelDirectory: AbsolutePath;
    backendDirectory: AbsolutePath;
    documentationDirectory: AbsolutePath;
    documentationSourceDirectory: AbsolutePath;
    vadModelPath: AbsolutePath;
    temporaryDirectory: AbsolutePath;
}>;

function developmentDataPath(projectPath: string, profile = "default"): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(profile)) {
        throw new Error("VESTIGE_PROFILE must contain 1-64 letters, digits, underscores, or hyphens, and start with a letter or digit.");
    }
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(profile)) {
        throw new Error("VESTIGE_PROFILE must not be a Windows reserved device name.");
    }
    return join(projectPath, ".local", "profiles", profile);
}

// Construction only: directory creation and Electron configuration stay in bootstrap.
export function createAppPaths(options: { packaged: boolean; appPath: string; resourcesPath: string; userDataPath: string; temporaryPath: string; profile?: string }): AppPaths {
    const dataDirectory = parseAbsolutePath(options.packaged ? options.userDataPath : developmentDataPath(options.appPath, options.profile));
    const resourcesDirectory = parseAbsolutePath(options.packaged ? options.resourcesPath : join(options.appPath, "resources"));
    const backendDirectory = parseAbsolutePath(join(dataDirectory, "backends"));
    return Object.freeze({
        dataDirectory,
        sessionDirectory: parseAbsolutePath(join(dataDirectory, "chromium")),
        logsDirectory: parseAbsolutePath(join(dataDirectory, "logs")),
        resourcesDirectory,
        runtimeDirectory: parseAbsolutePath(join(resourcesDirectory, "bin")),
        runtimeCacheDirectory: parseAbsolutePath(join(backendDirectory, ".runtimes")),
        modelDirectory: parseAbsolutePath(join(dataDirectory, "models")),
        backendDirectory,
        documentationDirectory: dataDirectory,
        documentationSourceDirectory: parseAbsolutePath(join(resourcesDirectory, "docs")),
        vadModelPath: parseAbsolutePath(join(resourcesDirectory, "bin", "vad", "silero_vad.onnx")),
        temporaryDirectory: parseAbsolutePath(join(options.temporaryPath, "vestige-transcription"))
    });
}