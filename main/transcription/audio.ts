import { monoPcm16Header } from "../../shared/audio/wave";
import { open, writeFile } from "node:fs/promises";
import { TranscriptionFailure } from "./failure";

export type WaveInfo = {
    format: number;
    channels: number;
    sampleRate: number;
    bitsPerSample: number;
    blockAlign: number;
    dataOffset: number;
    dataLength: number;
    duration: number;
};

// FFmpeg writes mono PCM16 WAV. Read RIFF chunks instead of assuming a 44-byte
// header: FFmpeg may include LIST/JUNK chunks before the samples.
export async function waveInfo(filename: string): Promise<WaveInfo> {
    const file = await open(filename, "r");
    try {
        const { size } = await file.stat();
        const header = Buffer.alloc(16);
        await file.read(header, 0, 12, 0);
        if (header.toString("ascii", 0, 4) !== "RIFF" || header.toString("ascii", 8, 12) !== "WAVE") {
            throw new TranscriptionFailure({ kind: "audio-invalid-wave" });
        }
        let byteRate = 0;
        let format = 0, channels = 0, sampleRate = 0, bitsPerSample = 0, blockAlign = 0;
        for (let position = 12; position + 8 <= size;) {
            await file.read(header, 0, 8, position);
            const kind = header.toString("ascii", 0, 4);
            const length = header.readUInt32LE(4);
            if (position + 8 + length > size) throw new TranscriptionFailure({ kind: "audio-truncated-wave" });
            if (kind === "fmt " && length >= 16) {
                await file.read(header, 0, 16, position + 8);
                format = header.readUInt16LE(0);
                channels = header.readUInt16LE(2);
                sampleRate = header.readUInt32LE(4);
                byteRate = header.readUInt32LE(8);
                blockAlign = header.readUInt16LE(12);
                bitsPerSample = header.readUInt16LE(14);
            }
            if (kind === "data" && byteRate > 0) return { format, channels, sampleRate, bitsPerSample, blockAlign, dataOffset: position + 8, dataLength: length, duration: length / byteRate };
            position += 8 + length + length % 2;
        }
        throw new TranscriptionFailure({ kind: "audio-empty-wave" });
    }
    finally {
        await file.close();
    }
}

export async function waveDuration(filename: string): Promise<number> {
    return (await waveInfo(filename)).duration;
}

export async function writeWaveSlice(filename: string, destination: string, info: WaveInfo, start: number, end: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (info.format !== 1 || info.channels !== 1 || info.sampleRate !== 16000 || info.bitsPerSample !== 16 || info.blockAlign !== 2) {
        throw new TranscriptionFailure({ kind: "audio-invalid-wave" });
    }
    const from = Math.round(start * info.sampleRate) * info.blockAlign;
    const to = Math.min(info.dataLength, Math.round(end * info.sampleRate) * info.blockAlign);
    if (from < 0 || to <= from) throw new TranscriptionFailure({ kind: "audio-empty-wave" });
    const samples = Buffer.alloc(to - from);
    const input = await open(filename, "r");
    try {
        for (let offset = 0; offset < samples.length;) {
            signal?.throwIfAborted();
            const { bytesRead } = await input.read(samples, offset, samples.length - offset, info.dataOffset + from + offset);
            if (!bytesRead) throw new TranscriptionFailure({ kind: "audio-truncated-wave" });
            offset += bytesRead;
        }
    }
    finally {
        await input.close();
    }
    const header = monoPcm16Header(info.sampleRate, samples.length);
    await writeFile(destination, Buffer.concat([header, samples]), { signal });
}