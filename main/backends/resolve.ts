import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { type Executor } from "../../shared/transcription/executor";
import { type AbsolutePath } from "../../shared/util/path";
import { parseAbsolutePath, isSystemError, resolveFilePath } from "../util/file";
import { VestigeErrors } from "../../shared/failure";
import { pathKey } from "../util/fs";
import { executorAdapters, type ExecutorTool } from "../transcription/adapters";
import { backendPackages } from "./catalog";

export type BackendLocation = {
    directory: AbsolutePath;
    executable: AbsolutePath;
    tools: Partial<Record<ExecutorTool, { executable: AbsolutePath | null; required: boolean }>>;
};

async function findProgram(directory: AbsolutePath, name: string): Promise<AbsolutePath | null> {
    // An explicit selection must never silently run a different program from PATH.
    for (const candidate of [join(directory, name), join(directory, "bin", name)]) {
        try {
            const executable = parseAbsolutePath(candidate);
            if (!(await stat(executable)).isFile()) continue;
            await access(executable, constants.X_OK);
            return executable;
        }
        catch (error) {
            if (!isSystemError(error)) throw error;
        }
    }
    return null;
}

export async function resolveBackend(executor: Executor, selection: string, root: AbsolutePath): Promise<BackendLocation> {
    if (!selection.trim()) throw new VestigeErrors({ kind: "transcription-empty-path", field: "backendDirectory" });
    const directory = resolveFilePath(root, selection);
    const adapter = executorAdapters[executor];
    const suffix = process.platform === "win32" ? ".exe" : "";
    const name = adapter.program + suffix;
    const executable = await findProgram(directory, name);
    if (!executable) throw new VestigeErrors({ kind: "native-not-found", executable: name, directory });
    // Known installation locations retain their package's tool requirements.
    // Other user-supplied directories can omit optional companion tools.
    const expectedPackage = backendPackages().find(backend => backend.executor === executor && pathKey(join(root, backend.id)) === pathKey(directory));
    const tools: BackendLocation["tools"] = {};
    for (const key of Object.keys(adapter.tools) as ExecutorTool[]) {
        const tool = adapter.tools[key]!;
        const filename = tool.program + suffix;
        const required = expectedPackage?.requiredFiles.includes(filename) ?? false;
        const path = await findProgram(parseAbsolutePath(dirname(executable)), filename);
        if (!path && required) throw new VestigeErrors({ kind: "native-not-found", executable: filename, directory });
        tools[key] = { executable: path, required };
    }
    return { directory, executable, tools };
}