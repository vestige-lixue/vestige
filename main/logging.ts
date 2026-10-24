import { randomUUID } from "node:crypto";
import { appendFileSync, closeSync, mkdirSync, openSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { formatWithOptions } from "node:util";

const reportError = console.error.bind(console);
const formatOptions = { colors: false, depth: null, maxArrayLength: null, maxStringLength: null };

export type LogKind = "application" | "task" | "download" | "transcription";

export class LogFile {
    private descriptor: number | null;
    private closed = false;

    constructor(readonly path: string, private readonly onClose?: () => void) {
        this.descriptor = openSync(path, "wx", 0o600);
    }

    write(text: string): void {
        if (this.closed) return;
        try {
            // Recreate cleared logs only when new output arrives.
            this.descriptor ??= openSync(this.path, "a", 0o600);
            // Write each chunk immediately, including output beyond the UI's tail.
            // No pending stream buffer is lost when the window closes or crashes.
            appendFileSync(this.descriptor, text, "utf8");
        }
        catch (error) {
            reportError("Could not write log:", this.path, error);
            this.dispose();
        }
    }

    record(event: string, value?: unknown): void {
        this.write(`\n[${new Date().toISOString()}] ${event}\n${value === undefined ? "" : formatWithOptions(formatOptions, value) + "\n"}`);
    }

    close(status: string): void {
        this.record(`Finished: ${status}`);
        this.dispose();
    }

    release(): void {
        const descriptor = this.descriptor;
        this.descriptor = null;
        if (descriptor === null) return;
        try {
            closeSync(descriptor);
        }
        catch (error) {
            reportError("Could not close log:", this.path, error);
        }
    }

    private dispose(): void {
        if (this.closed) return;
        this.closed = true;
        this.release();
        this.onClose?.();
    }
}

export class LogDirectory {
    private readonly files = new Set<LogFile>();

    constructor(readonly path: string) {}

    create(kind: LogKind, id?: string): LogFile | null {
        try {
            mkdirSync(this.path, { recursive: true });
            // Task IDs are metadata only; never use IPC input as a filename.
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const log = new LogFile(join(this.path, `${timestamp}_${kind}_${randomUUID()}.log`), () => this.files.delete(log));
            this.files.add(log);
            log.record("Started", { kind, id, pid: process.pid });
            return log;
        }
        catch (error) {
            reportError("Could not create log:", this.path, error);
            return null;
        }
    }

    clear(): void {
        mkdirSync(this.path, { recursive: true });
        const entries = readdirSync(this.path);
        for (const log of this.files) log.release();
        for (const entry of entries) rmSync(join(this.path, entry), { recursive: true, force: true });
    }
}

export function captureConsole(log: LogFile | null, target = console): () => void {
    const restore: (() => void)[] = [];
    for (const level of ["debug", "log", "info", "warn", "error"] as const) {
        const original = target[level];
        const capture = (...values: unknown[]): void => {
            log?.record(`main ${level}`, formatWithOptions(formatOptions, ...values));
            original.apply(target, values);
        };
        target[level] = capture;
        restore.push(() => {
            if (target[level] === capture) target[level] = original;
        });
    }
    return () => restore.forEach(restore => restore());
}