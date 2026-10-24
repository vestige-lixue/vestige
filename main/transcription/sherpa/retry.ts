import { type ExecutionContext } from "../execute";
import { TranscriptionFailure } from "../failure";
import { type AudioPart, splitAudioPart } from "./segmentation";

export type DecodeProblem = "context" | "tokens" | "repetition" | "prompt";
export type DecodedPart = { part: AudioPart; value: unknown };
export type BatchResult = { values: unknown[]; problem?: DecodeProblem };
export type DecodeBatch = (parts: AudioPart[], temperature?: number) => Promise<BatchResult>;
export type RetryContext = Pick<ExecutionContext, "signal" | "feedback"> & { fallbackTemperature?: number };

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
    depth = 0
): Promise<DecodedPart[]> {
    const { signal, feedback } = context;
    signal?.throwIfAborted();
    const { values, problem } = await decode(parts);
    signal?.throwIfAborted();
    if (!problem) return parts.map((part, index) => ({ part, value: values[index] }));

    // A prompt that alone fills the context cannot be repaired with less audio.
    if (problem === "prompt") throw new TranscriptionFailure({ kind: "transcription-truncated-output" });
    if (parts.length > 1) {
        feedback?.record?.("Sherpa retry", { reason: problem, mode: "isolate", parts, depth });
        const result: DecodedPart[] = [];
        for (const part of parts) result.push(...await decodeWithRetry([part], decode, context, depth));
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
            if (!retry.problem) return [{ part, value: retry.values[0] }];
        }
        feedback?.record?.("Sherpa retry exhausted", { reason: problem, part, depth });
        throw new TranscriptionFailure({ kind: "transcription-unstable-output", start: part.start.toFixed(3), end: part.end.toFixed(3) });
    }
    const children = await splitAudioPart(part, signal);
    feedback?.record?.("Sherpa retry", { reason: problem, mode: "split", part, children, depth: depth + 1 });
    feedback?.output("stderr", `[sherpa-onnx] Retrying ${part.start.toFixed(3)}-${part.end.toFixed(3)} s in shorter parts (${problem}).\n`);
    const result: DecodedPart[] = [];
    // Keep retry diagnostics associated with one window, including repeat-loop
    // warnings where native code has already removed the offending tokens.
    for (const child of children) result.push(...await decodeWithRetry([child], decode, context, depth + 1));
    return result;
}