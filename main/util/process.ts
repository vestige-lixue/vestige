import { VestigeErrors } from "../../shared/failure";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { type AbsolutePath } from "../../shared/util/path";
import { parseAbsolutePath, isSystemError } from "./file";

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
            const executable = parseAbsolutePath(candidate);
            await access(executable, constants.X_OK);
            return executable;
        }
        catch (error) {
            if (!isSystemError(error)) throw error;
        }
    }
    throw new VestigeErrors({ kind: "native-not-found", executable: filename, directory: parseAbsolutePath(join(runtimeRoot, runtime)) });
}

export type ProcessOutput = { stdout: string; stderr: string };
export type ProcessOutputListener = (stream: "stdout" | "stderr", text: string) => void;

export function runProcess(
    executable: AbsolutePath,
    args: string[],
    cwd: AbsolutePath,
    signal?: AbortSignal,
    onOutput?: ProcessOutputListener
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
            onOutput?.("stdout", data);
            if (stdout.length > 64 * 1024 * 1024) {
                failure = new VestigeErrors({ kind: "native-output-limit", limitMiB: 64 });
                abort();
            }
        });
        child.stderr.on("data", (data: string) => {
            stderr += data;
            onOutput?.("stderr", data);
        });
        child.on("error", error => {
            failure = new VestigeErrors({ kind: "native-spawn-failed", diagnostic: error.message }, { cause: error });
        });
        // Wait for close, including on cancellation, before deleting task files.
        child.on("close", (code, terminationSignal) => {
            signal?.removeEventListener("abort", abort);
            if (signal?.aborted) reject(signal.reason);
            else if (failure) reject(failure);
            else if (code !== 0) reject(new VestigeErrors({ kind: "native-failed", diagnostic: stderr || stdout || null, exitCode: code, signal: terminationSignal }));
            else accept({ stdout, stderr });
        });
    });
}