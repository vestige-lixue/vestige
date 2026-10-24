import { type ExecutionContext } from "../execute";
import { VestigeErrors } from "../../../shared/failure";
import { type AudioPart, splitAudioPart } from "./segmentation";
import { type DecodeProblem } from "../../../shared/transcription/Execution";
import { type Range } from "../../../shared/util/range";

export type DecodedPart = { part: AudioPart; value: unknown; originalRange: Range; options: Record<string, string>; reasons: DecodeProblem[] };
export type BatchResult = { values: unknown[]; options: Record<string, string>; problem?: DecodeProblem };
export type DecodeBatch = (parts: AudioPart[], temperature?: number) => Promise<BatchResult>;
export type RetryContext = Pick<ExecutionContext, "signal" | "feedback"> & { fallbackTemperature?: number };
type RetryState = { depth: number; originalRange: Range | null; reasons: DecodeProblem[] };

function accepted(part: AudioPart, value: unknown, options: Record<string, string>, state: RetryState): DecodedPart {
    return { part, value, originalRange: { ...state.originalRange ?? { start: part.start, end: part.end } }, options: { ...options }, reasons: [...state.reasons] };
}

export function qwenDecodeProblem(diagnostic: string): DecodeProblem | undefined {
    if (/prompt scaffold exceeds max_total_len|leaves no room for audio placeholders/.test(diagnostic)) return "prompt";
    if (/decode collapsed into a repetition loop/.test(diagnostic)) return "repetition";
    if (/Truncating audio placeholders/.test(diagnostic)) return "context";
    if (/Result is truncated\. max_new_tokens/.test(diagnostic)) return "tokens";
    return undefined;
}

// Native batch warnings do not identify the affected WAV. Isolate a failing
// batch before splitting only the affected part. Never accept a trimmed loop.
export async function decodeWithRetry(
    parts: AudioPart[],
    decode: DecodeBatch,
    context: RetryContext,
    state: RetryState = { depth: 0, originalRange: null, reasons: [] }
): Promise<DecodedPart[]> {
    const { signal, feedback } = context;
    signal?.throwIfAborted();
    const { depth } = state;
    const { values, options, problem } = await decode(parts);
    signal?.throwIfAborted();
    if (!problem) return parts.map((part, index) => accepted(part, values[index], options, state));
    const reasons = [...new Set([...state.reasons, problem])];

    // A prompt that alone fills the context cannot be repaired with less audio.
    if (problem === "prompt") throw new VestigeErrors({ kind: "transcription-truncated-output" });
    if (parts.length > 1) {
        feedback?.record?.("Sherpa retry", { reason: problem, mode: "isolate", parts, depth });
        const result: DecodedPart[] = [];
        for (const part of parts) result.push(...await decodeWithRetry([part], decode, context, { depth, originalRange: { start: part.start, end: part.end }, reasons }));
        return result;
    }

    const part = parts[0];
    if (depth >= 3 || part.end - part.start < 4) {
        if (problem === "repetition" && context.fallbackTemperature !== undefined) {
            // A short sung vowel can still trap greedy decoding. One low-
            // temperature attempt may escape it; explicit user sampling
            // parameters are never replaced by this application default.
            const temperature = context.fallbackTemperature;
            feedback?.record?.("Sherpa retry", { reason: problem, mode: "sampling", part, depth, temperature });
            feedback?.output("stderr", `[sherpa-onnx] Retrying ${part.start.toFixed(3)}-${part.end.toFixed(3)} s with temperature ${temperature}.\n`);
            signal?.throwIfAborted();
            const retry = await decode(parts, temperature);
            signal?.throwIfAborted();
            if (!retry.problem) return [accepted(part, retry.values[0], retry.options, { ...state, reasons })];
        }
        feedback?.record?.("Sherpa retry exhausted", { reason: problem, part, depth });
        throw new VestigeErrors({ kind: "transcription-unstable-output", start: part.start.toFixed(3), end: part.end.toFixed(3) });
    }
    const children = await splitAudioPart(part, signal);
    feedback?.record?.("Sherpa retry", { reason: problem, mode: "split", part, children, depth: depth + 1 });
    feedback?.output("stderr", `[sherpa-onnx] Retrying ${part.start.toFixed(3)}-${part.end.toFixed(3)} s in shorter parts (${problem}).\n`);
    const result: DecodedPart[] = [];
    // Keep retry diagnostics associated with one window, including repeat-loop
    // warnings where native code has already removed the offending tokens.
    for (const child of children) result.push(...await decodeWithRetry([child], decode, context, {
        depth: depth + 1, originalRange: state.originalRange ?? { start: part.start, end: part.end }, reasons
    }));
    return result;
}