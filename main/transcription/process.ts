import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { filePath } from "../util/file";

export async function findExecutable(runtimeRoot: AbsolutePath, runtime: string, name: string): Promise<AbsolutePath> {
    const filename = name + (process.platform === "win32" ? ".exe" : "");
    const candidates = [join(runtimeRoot, runtime, filename)];
    // Resolve PATH before changing cwd; a task directory is never an executable search path.
    for (const entry of (process.env.PATH ?? "").split(delimiter)) {
        const directory = entry.replace(/^"|"$/g, "");
        if (isAbsolute(directory)) candidates.push(join(directory, filename));
    }
    for (const candidate of candidates) {
        try {
            const executable = filePath(candidate);
            await access(executable, constants.X_OK);
            return executable;
        }
        catch { /* Try the next installed location. */ }
    }
    throw new Error(filename + " was not found. Install it with its native libraries in "
        + join(runtimeRoot, runtime) + ", or add it to PATH.");
}

export type ProcessOutput = { stdout: string; stderr: string };

export function runProcess(
    executable: AbsolutePath,
    args: string[],
    cwd: AbsolutePath,
    signal?: AbortSignal
): Promise<ProcessOutput> {
    signal?.throwIfAborted();
    return new Promise((accept, reject) => {
        const directory = dirname(executable);
        const libraryPaths = [directory, join(directory, "..", "lib")];
        const env = { ...process.env };
        const pathKey = Object.keys(env).find(key => key.toLowerCase() === "path") ?? "PATH";
        env[pathKey] = [...libraryPaths, env[pathKey] ?? ""].join(delimiter);
        for (const key of ["LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"]) {
            env[key] = [...libraryPaths, env[key] ?? ""].join(delimiter);
        }
        const child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        let failure: Error | undefined;
        const abort = (): void => {
            child.kill("SIGKILL");
        };
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (data: string) => {
            stdout += data;
            if (stdout.length > 64 * 1024 * 1024) {
                failure = new Error("Executer output exceeded 64 MiB.");
                abort();
            }
        });
        child.stderr.on("data", (data: string) => {
            stderr += data;
        });
        child.on("error", error => {
            failure = error;
        });
        // Wait for close, including on cancellation, before deleting task files.
        child.on("close", (code, terminationSignal) => {
            signal?.removeEventListener("abort", abort);
            if (signal?.aborted) reject(new Error("Transcription cancelled."));
            else if (failure) reject(failure);
            else if (code !== 0) reject(new Error(stderr || stdout || "Executer exited with " + (terminationSignal ?? code)));
            else accept({ stdout, stderr });
        });
    });
}