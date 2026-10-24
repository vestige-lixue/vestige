import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";
import { type Run } from "../../../shared/transcription/Run";
import { type ExecutionContext } from "../execute";
import { runProcess } from "../../util/process";
import { parseResult } from "../result";
import { nativeArguments } from "./parameters";
import { toRun } from "./result";
import { VestigeErrors } from "../../../shared/failure";
import { isSystemError } from "../../util/file";
import { whisperProgress } from "./progress";

export async function execute(context: ExecutionContext): Promise<Run> {
    const { id, request, backend, directory, audio, duration, signal, feedback } = context;
    const { executable } = backend;
    const outputFile = join(directory, "result");
    const args = [...nativeArguments(request.options), "--model", "models/ggml-base.en.bin",
        "--file", basename(audio), "--output-json-full", "--output-file", basename(outputFile), "--print-progress"];
    const start = performance.now();
    feedback?.record?.("Whisper command", { executable, args, directory });
    const report = whisperProgress(value => feedback?.progress(value));
    const output = await runProcess(executable, args, directory, signal, (stream, text) => {
        feedback?.output(stream, text);
        if (stream === "stderr") report(text);
    });
    const elapsed = (performance.now() - start) / 1000;
    let raw: string;
    try {
        raw = await readFile(outputFile + ".json", "utf8");
    }
    catch (error) {
        if (!isSystemError(error)) throw error;
        // Some native failures exit with 0 without creating their output file.
        throw new VestigeErrors({ kind: "transcription-invalid-result", diagnostic: output.stderr || output.stdout || error.message }, { cause: error });
    }
    feedback?.record?.("Whisper result.json", raw);
    return toRun(id, request, parseResult(raw, output.stderr), duration, elapsed);
}