import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { executors, type Executor } from "../../shared/transcription/executor";
import { type AbsolutePath } from "../../shared/util/path";
import { parseAbsolutePath, isSystemError, resolveFilePath } from "../util/file";
import { NativeProcessFailure } from "../util/process";
import { TranscriptionFailure } from "../transcription/failure";

export type BackendLocation = { directory: AbsolutePath; executable: AbsolutePath };

export async function resolveBackend(executor: Executor, selection: string, root: AbsolutePath): Promise<BackendLocation> {
    if (!selection.trim()) throw new TranscriptionFailure({ kind: "transcription-empty-path", field: "backendDirectory" });
    const directory = resolveFilePath(root, selection);
    const name = executors[executor].program + (process.platform === "win32" ? ".exe" : "");
    // An explicit selection must never silently run a different program from PATH.
    for (const candidate of [join(directory, name), join(directory, "bin", name)]) {
        try {
            const executable = parseAbsolutePath(candidate);
            if (!(await stat(executable)).isFile()) continue;
            await access(executable, constants.X_OK);
            return { directory, executable };
        }
        catch (error) {
            if (!isSystemError(error)) throw error;
        }
    }
    throw new NativeProcessFailure({ kind: "native-not-found", executable: name, directory });
}