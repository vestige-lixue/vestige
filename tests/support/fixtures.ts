import { type Modification } from "../../shared/Vestige";
import { type Project } from "../../shared/project/Project";
import { projectVersion } from "../../shared/project/constants";
import { type TranscriptSpan } from "../../shared/transcription/Run";
import { type AbsolutePath } from "../../shared/util/path";
import { type TextPosition } from "../../shared/util/range";

export function transcript(texts: readonly string[]): TranscriptSpan[] {
    return texts.map((text, index) => ({
        range: { start: index * 2, end: index * 2 + 1 },
        blankProb: 0.1,
        token: { text, prob: 0.8 }
    }));
}

// Independent coordinate helpers: reference results never call the production index.
export function sourcePosition(spans: readonly TranscriptSpan[], offset: number): TextPosition {
    let remaining = offset;
    for (let segmentIdx = 0; segmentIdx < spans.length; segmentIdx++) {
        const length = [...spans[segmentIdx].token.text].length;
        if (remaining < length) return { segmentIdx, offset: remaining };
        remaining -= length;
    }
    if (remaining !== 0) throw new RangeError("Reference offset is outside the original text.");
    return { segmentIdx: spans.length, offset: 0 };
}

export function sourceOffset(spans: readonly TranscriptSpan[], position: TextPosition): number {
    return spans.slice(0, position.segmentIdx).reduce((sum, span) => sum + [...span.token.text].length, 0) + position.offset;
}

export function modification(spans: readonly TranscriptSpan[], from: number, to: number, text: string): Modification {
    return { range: { start: sourcePosition(spans, from), end: sourcePosition(spans, to) }, text };
}

export function referenceText(spans: readonly TranscriptSpan[], modifications: readonly Modification[]): string {
    const original = [...spans.map(span => span.token.text).join("")];
    const changes = modifications.map(item => ({
        from: sourceOffset(spans, item.range.start),
        to: sourceOffset(spans, item.range.end),
        text: item.text
    })).sort((left, right) => left.from - right.from || left.to - right.to);
    let cursor = 0;
    const result: string[] = [];
    for (const change of changes) {
        if (change.from < cursor) throw new RangeError("Reference changes overlap.");
        result.push(original.slice(cursor, change.from).join(""), change.text);
        cursor = change.to;
    }
    result.push(original.slice(cursor).join(""));
    return result.join("");
}

export function project(spans: TranscriptSpan[] = transcript(["hello"]), modifications: Modification[] = []): Project {
    return {
        version: projectVersion,
        lastOpened: 0,
        vestiges: [{
            media: {
                id: "00000000-0000-4000-8000-000000000001",
                path: (process.platform === "win32" ? "C:\\media\\fixture.wav" : "/media/fixture.wav") as AbsolutePath,
                size: 1024,
                hash: "0123456789abcdef",
                kind: "audio",
                duration: Math.max(1, ...spans.map(span => span.range.end)),
                name: "fixture.wav"
            },
            playbackPosition: 0,
            displayedRunIdx: 0,
            modifications,
            runs: [{
                id: "00000000-0000-4000-8000-000000000002",
                startedAt: 0,
                config: { executor: "whisper.cpp", backendDirectory: "", modelDirectory: "", params: {} },
                language: "en",
                languageProb: 1,
                runTime: 0,
                transcript: spans
            }]
        }]
    };
}