import { performance } from "node:perf_hooks";
import { basename } from "node:path";
import { type Run } from "../../../shared/transcription/Run";
import { type ExecutionContext } from "../execute";
import { findExecutable, runProcess } from "../process";
import { parseResult } from "../result";
import { nativeArguments } from "./parameters";
import { toRun } from "./result";

export async function execute(context: ExecutionContext): Promise<Run> {
    const { request, runtimeDirectory, directory, audio, duration, signal } = context;
    const executable = await findExecutable(runtimeDirectory, "sherpa-onnx", "sherpa-onnx-offline");
    const args = [...nativeArguments(request.options, request.modelDirectory), basename(audio)];
    const start = performance.now();
    const output = await runProcess(executable, args, directory, signal);
    const elapsed = (performance.now() - start) / 1000;
    return toRun(request, parseResult(output.stdout, output.stderr), duration, elapsed);
}