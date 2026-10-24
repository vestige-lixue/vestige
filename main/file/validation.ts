import { cpus } from "node:os";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { setImmediate } from "node:timers/promises";
import { type MediaValidationLoad } from "../../shared/media/validation";

const delay = monitorEventLoopDelay({ resolution: 20 });
const logicalProcessors = Math.max(1, cpus().length);
const waiters = new Set<() => void>();
let bytesRead = 0;
let readers = 0;
let chunks = 0;
let playing = false;

export function beginValidationRead(): () => void {
    if (readers++ === 0) {
        delay.reset();
        delay.enable();
    }
    return () => {
        if (--readers === 0) delay.disable();
    };
}

export function recordValidationRead(bytes: number): void {
    bytesRead += bytes;
}

export function validationLoad(): MediaValidationLoad {
    const eventLoopDelayMs = delay.count > 0 ? delay.percentile(99) / 1_000_000 : 0;
    delay.reset();
    return { bytesRead, sampledAt: performance.now(), eventLoopDelayMs, logicalProcessors };
}

function wake(): void {
    for (const ready of [...waiters]) ready();
}

export function validationPlayback(value: boolean): void {
    playing = value;
    if (!playing) wake();
}

async function waitForChunk(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
        const cleanup = (): void => {
            waiters.delete(ready);
            signal.removeEventListener("abort", abort);
        };
        const ready = (): void => {
            cleanup();
            resolve();
        };
        const abort = (): void => {
            cleanup();
            reject(signal.reason);
        };
        waiters.add(ready);
        signal.addEventListener("abort", abort, { once: true });
    });
    signal.throwIfAborted();
}

// A playback transition does not restart hashes. Existing readers wait at chunk
// boundaries, so at most one background chunk remains active during playback.
export async function validationChunk<Value>(signal: AbortSignal, read: () => Promise<Value>): Promise<Value> {
    while (playing && chunks >= 1) await waitForChunk(signal);
    signal.throwIfAborted();
    chunks++;
    try {
        return await read();
    }
    finally {
        chunks--;
        wake();
        if (playing) await setImmediate(undefined, { signal });
    }
}