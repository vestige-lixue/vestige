import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export type HashResult = ({
    success: true;
    hash: string;
} | {
    success: false;
    error: string;
});

self.onmessage = async ({ data: file }: MessageEvent<File>): Promise<void> => {
    const hash = sha256.create();
    const chunkSize = 1024 * 1024;
    try {
        for (let offset = 0; offset < file.size; offset += chunkSize) {
            const chunk = await file.slice(offset, offset + chunkSize).arrayBuffer();
            hash.update(new Uint8Array(chunk));
        }
        self.postMessage({ success: true, hash: bytesToHex(hash.digest()) } satisfies HashResult);
    }
    catch (error) {
        self.postMessage({ success: false, error: error instanceof Error ? error.message : String(error) } satisfies HashResult);
    }
    finally {
        hash.destroy();
    }
};