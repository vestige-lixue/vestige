// A canonical 44-byte header for writing mono, signed 16-bit PCM samples.
// Readers must still parse RIFF chunks: other writers can include metadata chunks.
export function monoPcm16Header(sampleRate: number, dataBytes: number): Uint8Array {
    const header = new Uint8Array(44);
    const view = new DataView(header.buffer);
    const text = (at: number, value: string): void => {
        for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
    };
    text(0, "RIFF");
    view.setUint32(4, 36 + dataBytes, true);
    text(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, dataBytes, true);
    return header;
}