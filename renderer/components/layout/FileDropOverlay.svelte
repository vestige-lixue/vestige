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
        <p>{locked ? "请稍候再拖入文件" : "音频、视频或 .vestige 项目文件"}</p>
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
    import downloadIcon from "../../../resources/icons/carbon--download.svg?raw";
    import { importMedia, openProject } from "../../states/project.svelte";
    import { interfaceBlocked } from "../../states/commands";

    let { locked }: { locked: boolean } = $props();
    let dropArea: HTMLDivElement;
    let dragDepth = 0;
    let dragging = $state(false);

    function importFiles(files: File[]): void {
        if (!files.length) return;
        if (files.length === 1 && /\.vestige$/i.test(files[0].name)) {
            void openProject(() => window.api.file.getPathForFile(files[0]));
            return;
        }
        importMedia(files);
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
        const files = Array.from(event.dataTransfer.files);
        if (files.length) importFiles(files);
    }
</script>