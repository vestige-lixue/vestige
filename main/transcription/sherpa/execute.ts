import { performance } from "node:perf_hooks";
import { basename } from "node:path";
import { type TranscriptSpan } from "../../../shared/transcription/Run";
import { type ExecutionContext } from "../execute";
import { runProcess } from "../../util/process";
import { createRun, type RunDraft } from "../result";
import { VestigeErrors } from "../../../shared/failure";
import { nativeArguments } from "./parameters";
import { needsWordSeparator, parseBatchResults, toRun } from "./result";
import { maximumPartDuration, prepareAudioParts } from "./segmentation";
import { decodeWithRetry, qwenDecodeProblem } from "./retry";

export async function execute(context: ExecutionContext): Promise<RunDraft> {
    const { id, request, backend, model, execution, directory, signal, feedback } = context;
    const { executable } = backend;
    const options = model.options;
    const modelArgs = model.files.map(file => `--${file.role}=models/${file.filename}`);
    const qwen = model.strategy.kind === "qwen3-asr";
    const fallbackTemperature = model.strategy.kind === "qwen3-asr" ? model.strategy.fallbackTemperature ?? undefined : undefined;
    const start = performance.now();
    const parts = await prepareAudioParts(context);
    const batchSize = 4;
    execution.plan.parts = parts.map(({ start, end }) => ({ start, end }));
    execution.plan.segmentation = { maximumDuration: maximumPartDuration, batchSize };
    const transcript: TranscriptSpan[] = [];
    let language = "und";
    let previousText = "";
    // Bound native batching too: avoid loading the entire recording's feature
    // streams into memory while amortizing model startup across short slices.
    for (let index = 0; index < parts.length; index += batchSize) {
        signal?.throwIfAborted();
        const batch = parts.slice(index, index + batchSize);
        const results = await decodeWithRetry(batch, async (current, temperature) => {
            const currentOptions = temperature === undefined ? options : { ...options, "--qwen3-asr-temperature": String(temperature) };
            const args = [...nativeArguments(currentOptions), ...modelArgs, ...current.map(part => basename(part.filename))];
            feedback?.record?.("Sherpa command", { executable, args, directory, firstPart: index, totalParts: parts.length, parts: current });
            const output = await runProcess(executable, args, directory, signal, feedback?.output);
            const values = parseBatchResults(output.stdout, output.stderr, current.length);
            const problem = qwen ? qwenDecodeProblem(output.stderr) : undefined;
            feedback?.record?.("Sherpa batch result", { parts: current, problem: problem ?? null });
            return { values, options: { ...currentOptions }, problem };
        }, { ...context, fallbackTemperature });
        for (const { part, value, originalRange, options, reasons } of results) {
            const split = part.start !== originalRange.start || part.end !== originalRange.end;
            const changedOptions = Object.keys(options).length !== Object.keys(model.options).length
                || Object.entries(options).some(([key, value]) => !Object.hasOwn(model.options, key) || model.options[key] !== value);
            // Batch isolation alone changes no final boundary or parameter.
            if (split || changedOptions) execution.deviations.push({ originalRange: { ...originalRange }, range: { start: part.start, end: part.end }, options: { ...options }, reasons: [...reasons] });
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
    if (!transcript.some(segment => segment.token.text.trim())) throw new VestigeErrors({ kind: "transcription-empty-result" });
    const elapsed = (performance.now() - start) / 1000;
    return createRun(id, request, language, transcript, elapsed);
}