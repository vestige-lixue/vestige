import { type TranscriptSpan } from "../../../shared/transcription/Run";
import { type ParsedRequest } from "../parameters";
import { type NativeObject, type Piece, type RunDraft, object, array, probability, range, segments, createRun } from "../result";
import { VestigeErrors } from "../../../shared/failure";

function whisperTranscript(output: NativeObject, duration: number): TranscriptSpan[] {
    if (!Array.isArray(output.transcription)) throw new VestigeErrors({ kind: "transcription-invalid-output", executor: "whisper.cpp", field: "transcription" });
    return output.transcription.flatMap(value => {
        const segment = object(value);
        if (typeof segment.text !== "string") throw new VestigeErrors({ kind: "transcription-invalid-output", executor: "whisper.cpp", field: "segment.text" });
        const offsets = object(segment.offsets);
        const fallback = range(offsets.from, offsets.to, 0.001) ?? { start: 0, end: duration };
        const pieces = array(segment.tokens).map(object).filter(token => {
            // The full JSON includes decoder control tokens as well as text.
            return typeof token.text === "string" && !(typeof token.id === "number" && token.id >= 50256
                && /^(\[_.*\]|<\|.*\|>)$/.test(token.text));
        }).map((token): Piece => {
            const time = object(token.offsets);
            return { text: token.text as string, range: range(time.from, time.to, 0.001), prob: probability(token.p) };
        });
        return segments(segment.text, pieces, fallback, probability(segment.no_speech_prob, 0));
    });
}

export function toRun(id: string, request: ParsedRequest, value: unknown, duration: number, runTime: number): RunDraft {
    const output = object(value);
    return createRun(id, request, object(output.result).language, whisperTranscript(output, duration), runTime);
}