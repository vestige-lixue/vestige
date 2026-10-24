import { type WebContents } from "electron";
import { VestigeErrors } from "../../shared/failure";

type Callback = (...args: unknown[]) => unknown;

export function handle(contents: WebContents, channel: string, callback: Callback): void {
    contents.ipc.handle(channel, async (event, ...args: unknown[]) => {
        if (event.senderFrame !== contents.mainFrame) throw new VestigeErrors({ kind: "ipc-not-main-frame" });
        try {
            return await callback(...args);
        }
        catch (error) {
            console.error("IPC handler failed:", channel, error);
            throw error;
        }
    });
}

export function listen(contents: WebContents, channel: string, callback: Callback): void {
    contents.ipc.on(channel, (event, ...args: unknown[]) => {
        if (event.senderFrame !== contents.mainFrame) {
            console.warn("IPC listener rejected:", channel, { kind: "ipc-not-main-frame" });
            return;
        }
        try {
            Promise.resolve(callback(...args)).catch(error => console.error("IPC listener failed:", channel, error));
        }
        catch (error) {
            console.error("IPC listener failed:", channel, error);
        }
    });
}