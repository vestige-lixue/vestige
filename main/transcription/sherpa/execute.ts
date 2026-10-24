import { performance } from "node:perf_hooks";
import { basename } from "node:path";
import { type Run, type TranscriptSpan } from "../../../shared/transcription/Run";
import { type ExecutionContext } from "../execute";
import { runProcess } from "../../util/process";
import { createRun } from "../result";
import { TranscriptionFailure } from "../failure";
import { nativeArguments } from "./parameters";
import { modelArguments } from "./models";
import { needsWordSeparator, parseBatchResults, toRun } from "./result";
import { prepareAudioParts } from "./segmentation";
import { decodeWithRetry, qwenDecodeProblem } from "./retry";

export async function execute(context: ExecutionContext): Promise<Run> {
    const { id, request, backend, directory, signal, feedback } = context;
    const { executable } = backend;
    const options = { ...request.options };
    const modelArgs = await modelArguments(request.modelDirectory);
    const qwen = [...nativeArguments(options), ...modelArgs].some(arg => arg.startsWith("--qwen3-asr-decoder="));
    if (qwen && options["--qwen3-asr-max-new-tokens"] === undefined) options["--qwen3-asr-max-new-tokens"] = "256";
    const fallbackTemperature = qwen && !nativeArguments(options).some(arg => /^--qwen3-asr-temperature(?:=|$)/.test(arg)) ? 0.4 : undefined;
    const start = performance.now();
    const parts = await prepareAudioParts(context);
    const transcript: TranscriptSpan[] = [];
    let language = "und";
    let previousText = "";
    // Bound native batching too: avoid loading the entire recording's feature
    // streams into memory while amortizing model startup across short slices.
    for (let index = 0; index < parts.length; index += 4) {
        signal?.throwIfAborted();
        const batch = parts.slice(index, index + 4);
        const results = await decodeWithRetry(batch, async (current, temperature) => {
            const currentOptions = temperature === undefined ? options : { ...options, "--qwen3-asr-temperature": String(temperature) };
            const args = [...nativeArguments(currentOptions), ...modelArgs, ...current.map(part => basename(part.filename))];
            feedback?.record?.("Sherpa command", { executable, args, directory, firstPart: index, totalParts: parts.length, parts: current });
            const output = await runProcess(executable, args, directory, signal, feedback?.output);
            const values = parseBatchResults(output.stdout, output.stderr, current.length);
            const problem = qwen ? qwenDecodeProblem(output.stderr) : undefined;
            feedback?.record?.("Sherpa batch result", { parts: current, problem: problem ?? null });
            return { values, problem };
        }, { ...context, fallbackTemperature });
        for (const { part, value } of results) {
            const duration = part.end - part.start;
            const run = toRun(id, request, value, duration, 0, qwen);
            if (language === "und" && run.language !== "und") language = run.language;
            const text = run.transcript.map(segment => segment.token.text).join("");
            if (needsWordSeparator(previousText, text)) run.transcript[0].token.text = ` ${run.transcript[0].token.text}`;
            if (text) previousText = text;
            for (const segment of run.transcript) {
                transcript.push({ ...segment, range: {
                    start: part.start + Math.min(duration, Math.max(0, segment.range.start)),
                    end: part.start + Math.min(duration, Math.max(0, segment.range.end))
                } });
            }
        }
        feedback?.progress(Math.min(0.99, (index + batch.length) / parts.length));
    }
    if (!transcript.some(segment => segment.token.text.trim())) throw new TranscriptionFailure({ kind: "transcription-empty-result" });
    const elapsed = (performance.now() - start) / 1000;
    return createRun(id, request, language, transcript, elapsed);
}