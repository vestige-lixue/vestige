import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";
import { type Run } from "../../../shared/transcription/Run";
import { type ExecutionContext } from "../execute";
import { findExecutable, runProcess } from "../process";
import { parseResult } from "../result";
import { nativeArguments } from "./parameters";
import { toRun } from "./result";

export async function execute(context: ExecutionContext): Promise<Run> {
    const { request, runtimeDirectory, directory, audio, duration, signal } = context;
    const executable = await findExecutable(runtimeDirectory, "whisper.cpp", "whisper-cli");
    const outputFile = join(directory, "result");
    const args = [...nativeArguments(request.options, request.modelDirectory),
        "--file", basename(audio), "--output-json-full", "--output-file", basename(outputFile)];
    const start = performance.now();
    const output = await runProcess(executable, args, directory, signal);
    const elapsed = (performance.now() - start) / 1000;
    let raw: string;
    try {
        raw = await readFile(outputFile + ".json", "utf8");
    }
    catch (error) {
        // Some native failures exit with 0 without creating their output file.
        throw new Error(output.stderr || output.stdout || String(error));
    }
    return toRun(request, parseResult(raw, output.stderr), duration, elapsed);
}