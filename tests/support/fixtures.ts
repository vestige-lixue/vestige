import { type Modification } from "../../shared/Vestige";
import { type Project } from "../../shared/project/Project";
import { projectVersion } from "../../shared/project/constants";
import { type TranscriptSpan } from "../../shared/transcription/Run";
import { type AbsolutePath } from "../../shared/util/path";
import { type TextPosition } from "../../shared/util/range";
import { type Execution } from "../../shared/transcription/Execution";

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

export function modification(spans: readonly TranscriptSpan[], from: number, to: number, text: string): Modification[] {
    return [
        ...(from === to ? [] : [{ type: "delete" as const, range: { start: sourcePosition(spans, from), end: sourcePosition(spans, to) } }]),
        ...(text ? [{ type: "insert" as const, pos: sourcePosition(spans, from), text }] : [])
    ];
}

export function referenceText(spans: readonly TranscriptSpan[], modifications: readonly Modification[]): string {
    const original = [...spans.map(span => span.token.text).join("")];
    const deleted = new Set<number>();
    const insertions = new Map<number, string[]>();
    for (const item of modifications) {
        if (item.type === "insert") {
            const offset = sourceOffset(spans, item.pos);
            const values = insertions.get(offset) ?? [];
            values.push(item.text);
            insertions.set(offset, values);
        }
        else {
            const from = sourceOffset(spans, item.range.start);
            const to = sourceOffset(spans, item.range.end);
            if (to < from) throw new RangeError("Reference deletion is reversed.");
            for (let offset = from; offset < to; offset++) {
                if (deleted.has(offset)) throw new RangeError("Reference deletions overlap.");
                deleted.add(offset);
            }
        }
    }
    const result: string[] = [];
    for (let offset = 0; offset <= original.length; offset++) {
        result.push(...insertions.get(offset) ?? []);
        if (offset < original.length && !deleted.has(offset)) result.push(original[offset]);
    }
    return result.join("");
}

export function project(spans: TranscriptSpan[] = transcript(["hello"]), modifications: Modification[] = []): Project {
    const duration = Math.max(1, ...spans.map(span => span.range.end));
    const mediaPath = (process.platform === "win32" ? "C:\\media\\fixture.wav" : "/media/fixture.wav") as AbsolutePath;
    const program = { path: "/historical/fixture", version: null, sha256: null };
    const execution: Execution = {
        request: { executor: "whisper.cpp", backendDirectory: "", modelDirectory: "", params: {}, mediaPath, mediaDuration: duration },
        plan: {
            executor: "whisper.cpp",
            backend: { directory: "/historical/backend", program: { ...program }, tools: [] },
            model: { directory: "/historical/model", files: [{ role: "model", path: "/historical/model/model.bin", sha256: null }] },
            audio: { program: { ...program }, stream: "0:a:0", sampleRate: 16000, channels: 1, format: "pcm-s16le", duration },
            options: {}, nativeDefaults: null, strategy: { kind: "native", version: 1 }, segmentation: { maximumDuration: null, batchSize: 1 }, parts: [{ start: 0, end: duration }]
        },
        deviations: [], log: null
    };
    return {
        version: projectVersion,
        lastOpened: 0,
        vestiges: [{
            media: {
                id: "00000000-0000-4000-8000-000000000001",
                path: mediaPath,
                size: 1024,
                hash: "0123456789abcdef",
                kind: "audio",
                duration,
                name: "fixture.wav"
            },
            playbackPosition: 0,
            displayedRunIdx: 0,
            modifications,
            runs: [{
                id: "00000000-0000-4000-8000-000000000002",
                startedAt: 0,
                config: { executor: "whisper.cpp", backendDirectory: "", modelDirectory: "", params: {} },
                execution,
                language: "en",
                languageProb: 1,
                runTime: 0,
                transcript: spans
            }]
        }]
    };
}