import { type FileHandle } from "node:fs/promises";
import { createXXHash3 } from "hash-wasm";
import { beginValidationRead, recordValidationRead, validationChunk } from "./validation";

export async function hashMedia(file: FileHandle, size: number, signal: AbortSignal): Promise<string | null> {
    signal.throwIfAborted();
    const finish = beginValidationRead();
    try {
        // This is XXH3_64bits, not the older XXH64 algorithm.
        const hash = await createXXHash3(0, 0);
        const buffer = Buffer.allocUnsafe(Math.min(size, 1024 * 1024));
        let position = 0;
        while (position < size) {
            const bytesRead = await validationChunk(signal, async () => {
                const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, size - position), position);
                signal.throwIfAborted();
                recordValidationRead(bytesRead);
                hash.update(buffer.subarray(0, bytesRead));
                return bytesRead;
            });
            if (bytesRead === 0) return null;
            position += bytesRead;
        }
        signal.throwIfAborted();
        return hash.digest();
    }
    finally {
        finish();
    }
}