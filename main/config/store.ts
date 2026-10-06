import { type Failure, toFailure } from "../../shared/failure";
import { join } from "node:path";
import { type Config, type ConfigResult, type ConfigSnapshot } from "../../shared/config/Config";
import { readConfig, writeConfig } from "./file";
import { normalizeConfig, validatePatch, validatePlaybackPatch } from "./validate";
import { validSidebarWidth } from "../../shared/config/defaults";

export class ConfigStore {
    private readonly path: string;
    private config: Config;
    private savedText: string | null;
    private revision = 0;
    private pendingSaves = 0;
    private error: Failure | null = null;
    private writes: Promise<void> = Promise.resolve();
    private readonly listeners = new Set<(snapshot: ConfigSnapshot) => void>();

    constructor(root: string) {
        this.path = join(root, "config.json");
        const loaded = readConfig(this.path);
        this.config = loaded.config;
        this.savedText = loaded.savedText;
    }

    get(): ConfigSnapshot {
        return {
            config: structuredClone(this.config), revision: this.revision,
            dirty: JSON.stringify(this.config) !== this.savedText,
            saving: this.pendingSaves > 0, error: this.error
        };
    }

    subscribe(listener: (snapshot: ConfigSnapshot) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        this.revision++;
        for (const listener of this.listeners) {
            try {
                listener(this.get());
            }
            catch (error) {
                console.error(error);
            }
        }
    }

    update(value: unknown): ConfigResult {
        let patch;
        try {
            patch = validatePatch(value);
        }
        catch (error) {
            return { success: false, error: toFailure(error), snapshot: this.get() };
        }
        if ((patch.language !== undefined && this.config.language !== patch.language)
            || (patch.transcription !== undefined && this.config.transcription.concurrency !== patch.transcription.concurrency)) {
            this.config = { ...this.config, ...patch };
            this.notify();
        }
        return { success: true, snapshot: this.get() };
    }

    updateWindow(window: Config["window"]): void {
        const next = normalizeConfig({ ...this.config, window });
        if (JSON.stringify(next.window) === JSON.stringify(this.config.window)) return;
        this.config = next;
        this.notify();
    }

    setSidebarWidth(value: unknown): ConfigResult {
        if (!validSidebarWidth(value)) {
            return { success: false, error: { kind: "config-invalid-sidebar-width" }, snapshot: this.get() };
        }
        if (this.config.layout.sidebarWidth !== value) {
            this.config = { ...this.config, layout: { ...this.config.layout, sidebarWidth: value } };
            this.notify();
        }
        return { success: true, snapshot: this.get() };
    }

    updatePlayback(value: unknown): ConfigResult {
        let patch;
        try {
            patch = validatePlaybackPatch(value);
        }
        catch (error) {
            return { success: false, error: toFailure(error), snapshot: this.get() };
        }
        const playback = { ...this.config.playback, ...patch };
        if (JSON.stringify(playback) !== JSON.stringify(this.config.playback)) {
            this.config = { ...this.config, playback };
            this.notify();
        }
        return { success: true, snapshot: this.get() };
    }

    save(): Promise<ConfigResult> {
        // Capture at the explicit request, even when an earlier save is pending.
        const config = this.config;
        const text = JSON.stringify(config);
        this.pendingSaves++;
        this.error = null;
        this.notify();
        const operation = this.writes.then(async (): Promise<ConfigResult> => {
            try {
                await writeConfig(this.path, JSON.stringify(config, null, 4));
                this.savedText = text;
                this.error = null;
            }
            catch (error) {
                this.error = toFailure(error);
            }
            this.pendingSaves--;
            this.notify();
            return this.error === null ? { success: true, snapshot: this.get() }
                : { success: false, error: this.error, snapshot: this.get() };
        });
        this.writes = operation.then(() => {});
        return operation;
    }
}