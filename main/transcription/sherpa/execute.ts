import { performance } from "node:perf_hooks";
import { basename } from "node:path";
import { type Run } from "../../../shared/transcription/Run";
import { type ExecutionContext } from "../execute";
import { runProcess } from "../../util/process";
import { parseResult } from "../result";
import { nativeArguments } from "./parameters";
import { modelArguments } from "./models";
import { toRun } from "./result";

export async function execute(context: ExecutionContext): Promise<Run> {
    const { id, request, backend, directory, audio, duration, signal, feedback } = context;
    const { executable } = backend;
    const args = [...nativeArguments(request.options), ...await modelArguments(request.modelDirectory), basename(audio)];
    const start = performance.now();
    feedback?.record?.("Sherpa command", { executable, args, directory });
    const output = await runProcess(executable, args, directory, signal, feedback?.output);
    const elapsed = (performance.now() - start) / 1000;
    return toRun(id, request, parseResult(output.stdout, output.stderr), duration, elapsed);
}