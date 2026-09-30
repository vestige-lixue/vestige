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

{#if dragDepth > 0}
    <!-- todo: make it not covering nav -->
    <div class="file-drop-overlay">
        <div class="file-drop-message">
            <!-- todo: use an actual icon -->
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M24 8v22m-8-8 8 8 8-8M10 30v10h28V30" />
            </svg>
            <strong>{busy ? "正在处理项目" : "松开鼠标，导入媒体或打开项目"}</strong>
            <p>{busy ? "请稍候再拖入文件" : "音频、视频或 .vestige 项目文件"}</p>
        </div>
    </div>
{/if}


<style>
    .file-drop-overlay {
        -webkit-app-region: no-drag;
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: grid;
        place-items: center;
        padding: 32px;
        background: color-mix(in srgb, var(--c-background) 85%, transparent);
        backdrop-filter: blur(6px);
        pointer-events: none;
    }
    .file-drop-overlay::before {
        content: "";
        position: absolute;
        inset: 12px;
        border: 2px dashed var(--c-muted);
        border-radius: 12px;
    }
    .file-drop-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: var(--c-text);
        text-align: center;
    }
    svg {
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
    import { getMediaInfo } from "../media/media";
    import { addVestiges, openProject } from "../states/project.svelte";
    import { type Vestige } from "../../shared/Vestige";

    let { busy }: { busy: boolean } = $props();
    let dragDepth = $state(0);

    function importFiles(files: File[]): Promise<boolean> {
        if (!files.length) return Promise.resolve(false);
        if (files.length === 1 && /\.vestige$/i.test(files[0].name)) {
            return openProject(window.api.file.getPathForFile(files[0]));
        }
        return addVestiges(async () => {
            const vestiges: Vestige[] = [];
            for (const file of files) {
                const media = await getMediaInfo(file);
                vestiges.push({ media, runs: [], primaryRunIdx: 0, modifications: [] });
            }
            return vestiges;
        });
    }

    function resetDrag(): void {
        dragDepth = 0;
    }

    function handleDragEnter(event: DragEvent): void {
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        // Entering a child also fires dragenter before leaving the old target.
        // Count those transitions so the overlay stays visible across children.
        dragDepth += 1;
        event.dataTransfer.dropEffect = busy ? "none" : "copy";
    }

    function handleDragOver(event: DragEvent): void {
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        dragDepth = Math.max(1, dragDepth);
        event.dataTransfer.dropEffect = busy ? "none" : "copy";
    }

    function handleDragLeave(): void {
        dragDepth = Math.max(0, dragDepth - 1);
    }

    function handleDrop(event: DragEvent): void {
        resetDrag();
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        if (busy) return;
        const files = Array.from(event.dataTransfer.files);
        if (files.length) importFiles(files);
    }
</script>