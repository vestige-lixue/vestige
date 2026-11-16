type Bytes = string | readonly number[];
type Token = { text: Bytes; id?: number; offsets?: { from: number; to: number }; p?: number };
type Segment = { text: Bytes; tokens: Token[]; offsets?: { from: number; to: number }; no_speech_prob?: number };

// Serialize native UTF-8 bytes, including token strings that are individually
// invalid UTF-8. JSON syntax and escapes remain ordinary ASCII bytes.
export function whisperResult(segments: Segment[]): Buffer {
    const bytes = (value: Bytes): string => (typeof value === "string" ? Buffer.from(value) : Buffer.from(value)).toString("latin1");
    return Buffer.from(JSON.stringify({
        result: { language: "zh" },
        transcription: segments.map(segment => ({
            offsets: { from: 0, to: 2000 }, ...segment, text: bytes(segment.text),
            tokens: segment.tokens.map(token => ({ p: 1, ...token, text: bytes(token.text) }))
        }))
    }), "latin1");
}