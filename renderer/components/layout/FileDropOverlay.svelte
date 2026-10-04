<svelte:window
    ondragenter={handleDragEnter}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    ondragend={resetDrag}
    onblur={resetDrag}
    onkeydown={event => {
        if (event.key === "Escape") resetDrag();
    }}
/>

<div class="file-drop-overlay" class:active={dragging} bind:this={dropArea}>
    <div class="file-drop-message">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html downloadIcon}
        <strong>{locked ? "正在处理项目" : "松开鼠标，导入媒体或打开项目"}</strong>
        <p>{locked ? "请稍候再拖入文件" : "音频、视频、文件夹或单个 .vestige 项目文件"}</p>
    </div>
</div>


<style>
    .file-drop-overlay {
        -webkit-app-region: no-drag;
        position: fixed;
        inset: env(titlebar-area-height) 0 0;
        z-index: 12914;
        display: grid;
        place-items: center;
        padding: 0;
        pointer-events: none;
        visibility: hidden;
    }
    .file-drop-overlay.active {
        visibility: visible;
    }
    .file-drop-overlay::before {
        content: "";
        position: absolute;
        inset: 0 12px 12px;
        border: 2px dashed var(--c-muted);
        border-radius: 12px;
    }
    .file-drop-overlay::after {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        background: color-mix(in srgb, var(--c-background) 85%, transparent);
        backdrop-filter: blur(2px);
    }
    .file-drop-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: var(--c-text);
        text-align: center;
    }
    .file-drop-message :global(svg) {
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
    }
    strong {
        font-size: 20px;
        font-weight: 600;
    }
    p {
        margin: 0;
        color: var(--c-muted);
        font-size: 14px;
    }
</style>


<script lang="ts">
    import { onDestroy } from "svelte";
    import downloadIcon from "../../../resources/icons/carbon--download.svg?raw";
    import { interfaceBlocked } from "../../states/commands";
    import * as project from "../../states/project.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";

    let { locked }: { locked: boolean } = $props();
    let dropArea: HTMLDivElement;
    let dragDepth = 0;
    let dragging = $state(false);

    type DroppedItem = { file: File | null; entry: FileSystemEntry | null };
    let collection: AbortController | null = null;

    onDestroy(() => {
        if (!collection) return;
        collection.abort();
        mediaImport.endCollection(collection);
    });

    async function collectEntry(entry: FileSystemEntry, files: File[], failures: mediaImport.MediaImportFailure[], signal: AbortSignal): Promise<void> {
        if (signal.aborted) return;
        try {
            if (entry.isFile) {
                const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
                if (!signal.aborted) files.push(file);
            }
            else if (entry.isDirectory) {
                const reader = (entry as FileSystemDirectoryEntry).createReader();
                while (!signal.aborted) {
                    // Chromium returns directory entries in batches; read until the empty batch.
                    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
                    if (!entries.length) break;
                    for (const child of entries) await collectEntry(child, files, failures, signal);
                }
            }
        }
        catch (error) {
            if (!signal.aborted) failures.push({
                name: entry.fullPath || entry.name, path: null,
                error: "无法读取拖入的" + (entry.isDirectory ? "文件夹：" : "文件：") + (error instanceof Error ? error.message : String(error))
            });
        }
    }

    async function importDroppedItems(items: DroppedItem[]): Promise<void> {
        if (!items.length) return;
        const first = items[0];
        // Classify the original drop before flattening directories or discarding failures.
        if (items.length === 1 && !first.entry?.isDirectory && first.file && /\.vestige$/i.test(first.file.name)) {
            void project.openFile(first.file);
            return;
        }
        const current = mediaImport.beginCollection();
        if (!current) return;
        collection = current;
        try {
            const files: File[] = [];
            const failures: mediaImport.MediaImportFailure[] = [];
            for (const item of items) {
                if (current.signal.aborted) return;
                if (item.entry?.isDirectory || (!item.file && item.entry)) await collectEntry(item.entry, files, failures, current.signal);
                else if (item.file) files.push(item.file);
                else failures.push({ name: "拖入文件", path: null, error: "无法读取拖入的文件。" });
            }
            if (current.signal.aborted) return;
            project.importMedia(files);
            for (const failure of failures) mediaImport.reportImportFailure(failure);
        }
        finally {
            mediaImport.endCollection(current);
            if (collection === current) collection = null;
        }
    }

    function isInDropArea(event: DragEvent): boolean {
        const { left, top, right, bottom } = dropArea.getBoundingClientRect();
        return event.clientX >= left && event.clientX < right && event.clientY >= top && event.clientY < bottom;
    }

    function resetDrag(): void {
        dragDepth = 0;
        dragging = false;
    }

    function handleDragEnter(event: DragEvent): void {
        if (!event.dataTransfer?.types.includes("Files")) return;
        // Entering a child also fires dragenter before leaving the old target.
        // Count those transitions so the overlay stays visible across children.
        dragDepth += 1;
        handleDragOver(event);
    }

    function handleDragOver(event: DragEvent): void {
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        dragDepth = Math.max(1, dragDepth);
        dragging = isInDropArea(event);
        event.dataTransfer.dropEffect = locked || !dragging ? "none" : "copy";
    }

    function handleDragLeave(event: DragEvent): void {
        // Native cancellation or leaving the document has no next drop target.
        if (!event.relatedTarget) {
            resetDrag();
            return;
        }
        dragDepth = Math.max(0, dragDepth - 1);
        if (!dragDepth) dragging = false;
    }

    function handleDrop(event: DragEvent): void {
        resetDrag();
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        if (locked || interfaceBlocked() || !isInDropArea(event)) return;
        // Capture entries during drop, while the browser's drag data store is readable.
        const items: DroppedItem[] = Array.from(event.dataTransfer.items).filter(item => item.kind === "file")
            .map(item => ({ file: item.getAsFile(), entry: item.webkitGetAsEntry() }));
        if (!items.length) for (const file of Array.from(event.dataTransfer.files)) items.push({ file, entry: null });
        void importDroppedItems(items);
    }
</script>