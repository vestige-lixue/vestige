import { open } from "node:fs/promises";

// FFmpeg writes mono PCM16 WAV. Read RIFF chunks instead of assuming a 44-byte
// header: FFmpeg may include LIST/JUNK chunks before the samples.
export async function waveDuration(filename: string): Promise<number> {
    const file = await open(filename, "r");
    try {
        const { size } = await file.stat();
        const header = Buffer.alloc(16);
        await file.read(header, 0, 12, 0);
        if (header.toString("ascii", 0, 4) !== "RIFF" || header.toString("ascii", 8, 12) !== "WAVE") {
            throw new Error("Audio conversion did not produce a PCM WAV file.");
        }
        let byteRate = 0;
        for (let position = 12; position + 8 <= size;) {
            await file.read(header, 0, 8, position);
            const kind = header.toString("ascii", 0, 4);
            const length = header.readUInt32LE(4);
            if (position + 8 + length > size) throw new Error("Converted WAV file is truncated.");
            if (kind === "fmt " && length >= 16) {
                await file.read(header, 0, 16, position + 8);
                byteRate = header.readUInt32LE(8);
            }
            if (kind === "data" && byteRate > 0) return length / byteRate;
            position += 8 + length + length % 2;
        }
        throw new Error("Converted WAV file contains no audio data.");
    }
    finally {
        await file.close();
    }
}