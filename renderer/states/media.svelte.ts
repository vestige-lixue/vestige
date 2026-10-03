import { type Project } from "../../shared/project/Project";
import { type Vestige } from "../../shared/Vestige";
import { type MediaIssueStatus } from "../../shared/media/check";
import { getFileName, type AbsolutePath } from "../../shared/util/path";
import { getMediaInfo, type MediaInput, type MediaImportStage } from "../media/media";

export type MediaItemState = {
    name: string;
    source: MediaInput;
    vestige: Vestige | null;
    stage: MediaImportStage | MediaIssueStatus | "queued" | "locating" | "ready";
    error: string | null;
    checkedPath: AbsolutePath | null;
    ignored: boolean;
};

export function isMediaIssue(stage: MediaItemState["stage"]): stage is MediaIssueStatus {
    return stage === "missing" || stage === "changed" || stage === "unreadable";
}

export const mediaIssueLabels: Record<MediaIssueStatus, string> = {
    missing: "找不到媒体文件",
    changed: "媒体文件已变化",
    unreadable: "无法读取媒体文件"
};

export type MediaImportFailure = {
    name: string;
    path: AbsolutePath | null;
    error: string;
};

type MediaTaskSource = ({
    kind: "import";
} | {
    kind: "check";
    path: AbsolutePath;
} | {
    kind: "relink";
    previous: Pick<MediaItemState, "stage" | "error" | "checkedPath">;
});

type MediaImportTask = {
    source: MediaTaskSource;
    controller: AbortController;
    promise: Promise<void>;
    finish: () => void;
    started: boolean;
};

type MediaImportSession = {
    project: Project | null;
    createProject?: () => Project;
    tasks: Map<MediaItemState, MediaImportTask>;
};

class MediaImports {
    items = $state<MediaItemState[]>([]);
    selected = $state<MediaItemState | null>(null);
    importFailures = $state<MediaImportFailure[]>([]);
    #concurrency = $state(2);
    #session: MediaImportSession | null = null;
    #running = 0;

    // The settings UI can assign this directly. Running tasks keep their slots.
    get concurrency(): number {
        return this.#concurrency;
    }

    set concurrency(value: number) {
        if (!Number.isSafeInteger(value) || value < 1) throw new RangeError("Media import concurrency must be a positive integer.");
        this.#concurrency = value;
        this.#pump();
    }

    get pending(): boolean {
        return this.items.some(item => item.vestige === null);
    }

    get issue(): MediaItemState | null {
        // Track all fields even while an earlier condition excludes the item.
        return this.items.find(({ vestige, stage, ignored }) => vestige !== null && isMediaIssue(stage) && !ignored) ?? null;
    }

    dismissImportFailure(failure: MediaImportFailure): void {
        const index = this.importFailures.indexOf(failure);
        if (index >= 0) this.importFailures.splice(index, 1);
    }

    get selecting(): boolean {
        return this.items.some(item => item.stage === "locating");
    }

    setProject(project: Project | null): void {
        if (project !== null && this.#session?.project === project) return;
        const previous = this.#session;
        this.#session = null;
        if (previous) {
            for (const task of previous.tasks.values()) {
                task.controller.abort();
                if (!task.started) task.finish();
            }
            previous.tasks.clear();
        }
        this.items = project?.vestiges.map(vestige => ({
            name: vestige.media.name, source: vestige.media.path, vestige, stage: "queued", error: null,
            checkedPath: vestige.media.path, ignored: false
        })) ?? [];
        this.selected = this.items[0] ?? null;
        this.importFailures = [];
        if (project) {
            const session = this.#session = { project, tasks: new Map() };
            for (const item of this.items) this.#enqueue(session, item, { kind: "check", path: item.vestige!.media.path });
            this.#pump();
        }
    }

    add(sources: MediaInput[], createProject: () => Project): void {
        const session = this.#session ??= { project: null, createProject, tasks: new Map() };
        for (const source of sources) {
            this.items.push({ name: typeof source === "string" ? getFileName(source) : source.name,
                source, vestige: null, stage: "queued", error: null, checkedPath: null, ignored: false });
            // Use the reactive item identity for both the list and task registry.
            this.#enqueue(session, this.items[this.items.length - 1], { kind: "import" });
        }
        this.#pump();
    }

    retry(item: MediaItemState): void {
        const session = this.#session;
        if (!session || !item.vestige || !this.items.includes(item) || !isMediaIssue(item.stage)) return;
        this.#enqueue(session, item, { kind: "check", path: item.checkedPath ?? item.vestige.media.path });
        this.#pump();
    }

    relink(item: MediaItemState): void {
        const session = this.#session;
        if (!session || !item.vestige || !this.items.includes(item) || !isMediaIssue(item.stage)) return;
        this.#enqueue(session, item, { kind: "relink", previous: {
            stage: item.stage, error: item.error, checkedPath: item.checkedPath
        } });
        this.#pump();
    }

    ignore(item: MediaItemState): void {
        if (!item.vestige || !this.items.includes(item) || !isMediaIssue(item.stage)) return;
        item.ignored = true;
    }

    review(item: MediaItemState): void {
        if (item.vestige && this.items.includes(item) && isMediaIssue(item.stage)) item.ignored = false;
    }

    select(item: MediaItemState): void {
        // Saved records and their Runs remain accessible without a readable media file.
        if (item.vestige && this.items.includes(item)) this.selected = item;
    }

    adjacent(direction: -1 | 1): MediaItemState | null {
        const index = this.selected ? this.items.indexOf(this.selected) : -1;
        if (index < 0) return null;
        for (let next = index + direction; next >= 0 && next < this.items.length; next += direction) {
            if (this.items[next].vestige) return this.items[next];
        }
        return null;
    }

    moveSelection(direction: -1 | 1): void {
        const next = this.adjacent(direction);
        if (next) this.select(next);
    }

    playbackFailed(item: MediaItemState): void {
        if (!this.items.includes(item) || item.stage !== "ready") return;
        this.#reportFailure(item, "unreadable", "无法播放媒体，请重试或重新定位文件。", item.checkedPath);
    }

    remove(item: MediaItemState): void {
        const session = this.#session;
        const index = this.items.indexOf(item);
        if (!session || index < 0) return;
        const task = session.tasks.get(item);
        // Invalidate first: cancellation and late callbacks must not restore the item.
        session.tasks.delete(item);
        const nextSelection = this.selected === item ? this.adjacent(1) ?? this.adjacent(-1) : this.selected;
        this.items.splice(index, 1);
        this.selected = nextSelection;
        if (task) {
            task.controller.abort();
            if (!task.started) task.finish();
        }
        if (item.vestige && session.project) {
            const index = session.project.vestiges.indexOf(item.vestige);
            if (index >= 0) session.project.vestiges.splice(index, 1);
        }
        this.#pump();
    }

    rename(item: MediaItemState, name: string): void {
        const trimmedName = name.trim();
        if (!trimmedName || !this.items.includes(item)) return;
        item.name = trimmedName;
        if (item.vestige) item.vestige.media.name = trimmedName;
    }

    #reportFailure(item: MediaItemState, status: MediaIssueStatus, error: string, path: AbsolutePath | null): void {
        if (item.vestige) {
            item.stage = status;
            item.error = error;
            item.checkedPath = path;
            item.ignored = false;
        }
        else {
            // Keep diagnostics independently of rows: concurrent failures must not retain incomplete media.
            this.importFailures.push({ name: item.name, path, error });
            this.remove(item);
        }
    }

    #enqueue(session: MediaImportSession, item: MediaItemState, source: MediaTaskSource): void {
        let finish!: () => void;
        const promise = new Promise<void>(resolve => {
            finish = resolve;
        });
        item.stage = "queued";
        item.error = null;
        item.ignored = false;
        session.tasks.set(item, { source, controller: new AbortController(), promise, finish, started: false });
    }

    #pump(): void {
        const session = this.#session;
        if (!session) return;
        for (const [item, task] of session.tasks) {
            if (this.#running >= this.#concurrency) break;
            if (task.started) continue;
            task.started = true;
            this.#running++;
            void this.#run(session, item, task);
        }
    }

    #current(session: MediaImportSession, item: MediaItemState, task: MediaImportTask): boolean {
        return this.#session === session && session.tasks.get(item) === task;
    }

    async #run(session: MediaImportSession, item: MediaItemState, task: MediaImportTask): Promise<void> {
        try {
            let source = task.source.kind === "check" ? task.source.path : item.source;
            if (task.source.kind === "relink") {
                item.stage = "locating";
                const selected = await window.api.file.selectMediaPath(item.checkedPath ?? item.vestige?.media.path ?? null);
                if (!this.#current(session, item, task)) return;
                if (selected === null) {
                    Object.assign(item, task.source.previous);
                    return;
                }
                source = selected;
            }
            item.source = source;
            const result = await getMediaInfo(source, item.vestige?.media ?? null, stage => {
                if (this.#current(session, item, task)) item.stage = stage;
            }, task.controller.signal);
            if (!this.#current(session, item, task)) return;
            if (result.status !== "available") {
                this.#reportFailure(item, result.status, result.error, result.path);
                return;
            }
            const media = result.media;
            item.checkedPath = media.path;
            item.source = media.path;
            if (item.vestige) {
                item.vestige.media.path = media.path;
            }
            else {
                // No persistent project exists until one complete media record is ready.
                session.project ??= session.createProject!();
                media.name = item.name;
                // Completed files keep their drop order even when earlier files are slower.
                const index = this.items.slice(0, this.items.indexOf(item)).filter(entry => entry.vestige !== null).length;
                session.project.vestiges.splice(index, 0, { media, runs: [], primaryRunIdx: 0, modifications: [] });
                item.vestige = session.project.vestiges[index];
            }
            item.stage = "ready";
            this.selected ??= item;
        }
        catch (error) {
            if (!this.#current(session, item, task) || task.controller.signal.aborted) return;
            const message = error instanceof Error ? error.message : String(error);
            this.#reportFailure(item, "unreadable", message, typeof item.source === "string" ? item.source : item.checkedPath);
            console.error(message);
        }
        finally {
            if (session.tasks.get(item) === task) session.tasks.delete(item);
            this.#running--;
            task.finish();
            this.#pump();
        }
    }
}

export const mediaImports = new MediaImports();