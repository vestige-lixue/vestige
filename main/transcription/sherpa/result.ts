import { type Run, type Segment } from "../../../shared/transcription/Run";
import { type ParsedRequest } from "../parameters";
import { type NativeObject, type Piece, object, array, number, probability, range, segments, createRun } from "../result";

function sherpaTranscript(output: NativeObject, duration: number): Segment[] {
    if (typeof output.text !== "string") throw new Error("sherpa-onnx returned no transcript text.");
    const tokens = array(output.tokens);
    const timestamps = array(output.timestamps);
    const durations = array(output.durations);
    const logProbs = array(output.ys_log_probs);
    const pieces = tokens.map((token, index): Piece => {
        const start = number(timestamps[index]);
        const length = number(durations[index]);
        const end = start !== undefined && length !== undefined ? start + length : timestamps[index + 1] ?? duration;
        const logProb = number(logProbs[index]);
        return {
            text: typeof token === "string" ? token.replace(/▁/g, " ").replace(/@@$/g, "") : "",
            range: range(start, end, duration),
            prob: logProb === undefined ? 1 : probability(Math.exp(logProb))
        };
    });
    const tokenSegments = segments(output.text, pieces, { start: 0, end: duration });
    if (pieces.length && pieces.every(piece => piece.range) && tokenSegments.length > 1) return tokenSegments;

    const texts = array(output.segment_texts);
    const starts = array(output.segment_timestamps);
    const lengths = array(output.segment_durations);
    if (texts.length && texts.every(text => typeof text === "string") && texts.join("") === output.text) {
        return texts.map((text, index) => {
            const start = number(starts[index]);
            const length = number(lengths[index]);
            return {
                range: range(start, start !== undefined && length !== undefined ? start + length : undefined, duration)
                    ?? { start: 0, end: duration },
                blankProb: 0,
                token: { text: text as string, prob: 1 }
            };
        });
    }
    return tokenSegments;
}

export function toRun(request: ParsedRequest, value: unknown, duration: number, runTime: number): Run {
    const output = object(value);
    return createRun(request, output.lang, sherpaTranscript(output, duration), runTime);
}