import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { basename, dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { type AbsolutePath } from "../../shared/util/path";
import { findExecutable, runProcess } from "../util/process";
import { type DownloadTransfer } from "./types";

type DownloadStatus = {
    status: string;
    totalLength: string;
    completedLength: string;
    errorCode?: string;
    errorMessage?: string;
};

async function availablePort(): Promise<number> {
    const server = createServer();
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                server.close();
                reject(new Error("Could not allocate an aria2 RPC port."));
                return;
            }
            server.close(error => error ? reject(error) : resolve(address.port));
        });
    });
}

async function systemProxy(url: string, resolveProxy: (url: string) => Promise<string>, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    const controller = new AbortController();
    try {
        const result = await Promise.race([
            resolveProxy(url),
            delay(15_000, undefined, { signal: AbortSignal.any([signal, controller.signal]) }).then(() => {
                throw new Error("System proxy resolution timed out.");
            })
        ]);
        signal.throwIfAborted();
        const preferred = result.split(";", 1)[0].trim();
        if (preferred === "DIRECT") return "";
        const proxy = /^PROXY\s+(\S+)$/i.exec(preferred);
        if (!proxy) throw new Error("The system proxy is not supported by aria2. Configure an HTTP proxy in system settings.");
        return `http://${proxy[1]}`;
    }
    finally {
        controller.abort();
    }
}

export function aria2Transfer(runtimeDirectory: AbsolutePath, resolveProxy: (url: string) => Promise<string> = async () => "DIRECT"): DownloadTransfer {
    return async (files, directory, reporter, signal) => {
        signal.throwIfAborted();
        const executable = await findExecutable(runtimeDirectory, "aria2", "aria2c");
        const port = await availablePort();
        const secret = randomBytes(24).toString("hex");
        const controller = new AbortController();
        const processSignal = AbortSignal.any([signal, controller.signal]);
        let exited = false;
        let failure: unknown;
        const completion = runProcess(executable, [
            "--no-conf=true", "--enable-rpc=true", "--rpc-listen-all=false", "--rpc-allow-origin-all=false",
            `--rpc-listen-port=${port}`, `--rpc-secret=${secret}`, `--stop-with-process=${process.pid}`,
            "--http-accept-gzip=true", "--console-log-level=notice", "--summary-interval=1",
            "--show-console-readout=true", "--enable-color=false", "--truncate-console-readout=false",
            "--file-allocation=none", "--max-concurrent-downloads=3", "--split=4", "--max-connection-per-server=4",
            "--min-split-size=8M", "--auto-file-renaming=false", "--allow-overwrite=false", "--continue=false",
            "--follow-torrent=false", "--follow-metalink=false", "--check-certificate=true",
            "--all-proxy=", "--http-proxy=", "--https-proxy=", "--no-proxy=",
            "--connect-timeout=15", "--timeout=60", "--max-tries=3", "--retry-wait=2"
        ], directory, processSignal, (_stream, text) => reporter.append(text)).then(() => {
            exited = true;
        }, (error: unknown) => {
            exited = true;
            failure = error;
        });
        const checkProcess = (): void => {
            signal.throwIfAborted();
            if (exited) throw failure ?? new Error("aria2 exited before all downloads completed.");
        };
        const rpc = async <T>(method: string, params: unknown[] = []): Promise<T> => {
            const response = await fetch(`http://127.0.0.1:${port}/jsonrpc`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [`token:${secret}`, ...params] }),
                signal: AbortSignal.any([processSignal, AbortSignal.timeout(3_000)])
            });
            if (!response.ok) throw new Error(`aria2 RPC HTTP ${response.status}.`);
            const result = await response.json() as { result: T; error?: { message: string } };
            if (result.error) throw new Error(`aria2: ${result.error.message}`);
            return result.result;
        };
        try {
            const deadline = Date.now() + 15_000;
            while (true) {
                checkProcess();
                try {
                    await rpc("aria2.getVersion");
                    break;
                }
                catch (error) {
                    checkProcess();
                    if (Date.now() >= deadline) throw error;
                    await delay(100, undefined, { signal: processSignal });
                }
            }
            const downloads: { gid: string; destination: AbsolutePath }[] = [];
            for (const file of files) {
                checkProcess();
                const proxy = await systemProxy(file.url, resolveProxy, processSignal);
                checkProcess();
                reporter.append(`Downloading ${basename(file.destination)}\n${file.url}\n`);
                reporter.append(`System proxy: ${proxy || "DIRECT"}\n`);
                const gid = await rpc<string>("aria2.addUri", [[file.url], {
                    dir: dirname(file.destination), out: basename(file.destination),
                    "all-proxy": proxy, "http-proxy": proxy, "https-proxy": proxy, "no-proxy": ""
                }]);
                downloads.push({ gid, destination: file.destination });
            }
            while (true) {
                checkProcess();
                const statuses = await Promise.all(downloads.map(async file => ({
                    file,
                    status: await rpc<DownloadStatus>("aria2.tellStatus", [file.gid,
                        ["status", "totalLength", "completedLength", "errorCode", "errorMessage"]])
                })));
                let total = 0, completed = 0, known = true;
                for (const { file, status } of statuses) {
                    if (status.status === "error" || status.status === "removed") {
                        throw new Error(`aria2 ${status.errorCode ?? status.status}: ${basename(file.destination)}: ${status.errorMessage ?? "Download stopped."}`);
                    }
                    const received = Number(status.completedLength);
                    const length = Number(status.totalLength) || (status.status === "complete" ? received : 0);
                    if (!(length > 0)) known = false;
                    total += length;
                    completed += received;
                }
                const finished = statuses.every(({ status }) => status.status === "complete");
                reporter.progress(finished ? 0.99 : known && total > 0 ? Math.min(0.99, completed / total) : null);
                if (finished) break;
                await delay(250, undefined, { signal: processSignal });
            }
            await rpc("aria2.shutdown");
            // The child must release its file handles before the staging directory is published or removed.
            const deadlineExit = Date.now() + 10_000;
            while (!exited && Date.now() < deadlineExit) await delay(100, undefined, { signal });
            if (!exited) throw new Error("aria2 did not shut down after completing the downloads.");
            if (failure) throw failure;
        }
        catch (error) {
            signal.throwIfAborted();
            throw error;
        }
        finally {
            controller.abort();
            await completion;
        }
    };
}