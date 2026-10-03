<div class="media hoverable" class:selected={mediaImports.selected === item} class:ignored={item.ignored}
    role="button" tabindex={item.vestige ? 0 : -1} aria-pressed={mediaImports.selected === item}
    onclick={() => {
        if (!projectState.locked) mediaImports.select(item);
    }}
    onkeydown={event => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            if (!projectState.locked) mediaImports.select(item);
        }
    }}
>
    <Tooltip text="双击编辑名称" disabled={projectState.locked} tabindex={-1}>
        {#snippet child({ props })}
            <div {...props}>
                <NiceLabel
                    value={item.vestige?.media.name ?? item.name}
                    editable={!projectState.locked}
                    onchange={name => renameMedia(item, name)}
                    scrollMode="ontime"
                    scrollParam={1.5}
                    scrollPause={0.5}
                />
            </div>
        {/snippet}
    </Tooltip>
    <div class="media-actions">
        <div class="media-info" title={item.error ?? undefined}>
            {#if item.vestige}
                <span>{item.vestige.media.kind === "audio" ? "音频": "视频"}，{getSemanticDuration(item.vestige.media.duration)}</span>
            {/if}
            {#if isMediaIssue(item.stage)}
                <button class="media-issue import-error" disabled={projectState.locked} onclick={() => reviewMedia(item)}>
                    {mediaIssueLabels[item.stage]}{item.ignored ? "（已忽略）" : ""}
                </button>
            {:else if item.stage !== "ready"}
                <span class="import-progress">
                    <Spinner size="12px" />
                    {item.stage === "queued" && item.vestige ? "等待检查" : importStages[item.stage]}
                </span>
            {/if}
        </div>
        <Tooltip
            text={transcriptions.label(item)}
            disabled={transcriptionDisabled(item)}
            onclick={() => runMediaTranscription(item)}
        >
            {#snippet child({ props })}
                <button {...props} class="hoverable activable transcription-action">
                    {#if task && task.status !== "failed"}
                        <Spinner />
                    {:else}
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html task?.status === "failed" ? taskRemoveIcon : item.vestige?.runs.length ? taskCompleteIcon : taskAddIcon}
                    {/if}
                </button>
            {/snippet}
        </Tooltip>
        <Tooltip
            text={confirmingRemove ? "再次点击确认" : item.vestige ? "从项目中移除" : "取消导入"}
            bind:open={removeTooltipOpen}
            disableCloseOnTriggerClick
            disabled={projectState.locked}
            onclick={handleRemove}
        >
            {#snippet child({ props })}
                <button {...props} class="hoverable activable danger" bind:this={removeButton}>
                    {#if confirmingRemove}
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html checkIcon}
                    {:else}
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html removeIcon}
                    {/if}
                </button>
            {/snippet}
        </Tooltip>
    </div>
</div>


<style>
    .media {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px;
        border-radius: 8px;
        --bg: var(--c-background);
        background: var(--bg);
    }
    .media.selected {
        --selected-bg: color-mix(in srgb, var(--c-selection) 40%, var(--c-background));
        --bg: var(--selected-bg);
    }
    .media.ignored {
        --bg: color-mix(in srgb, var(--c-danger) 12%, var(--c-background));
    }
    .media.selected.ignored {
        --bg: color-mix(in srgb, var(--c-danger) 12%, var(--selected-bg));
    }
    .media-actions {
        display: flex;
        flex-flow: row nowrap;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
    }
    .media-info {
        color: var(--c-muted);
        font-size: 12px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        min-width: 0;
        flex: 1;
    }
    .import-progress {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .import-error {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    button {
        display: grid;
        place-items: center;
        height: 1lh;
        width: 1lh;
        flex-shrink: 0;
    }
    button.media-issue {
        display: block;
        width: auto;
        min-width: 0;
        max-width: 100%;
        height: auto;
        text-align: left;
        color: inherit;
    }
    button:disabled {
        opacity: 0.4;
    }
    button :global(svg) {
        display: block;
        height: 100%;
        width: 100%;
        pointer-events: none;
    }
</style>


<script lang="ts">
    import { mediaImports, isMediaIssue, mediaIssueLabels, type MediaItemState } from "../../states/media.svelte";
    import { projectState, renameMedia, removeMedia, reviewMedia } from "../../states/project.svelte";
    import { transcriptions } from "../../states/transcription.svelte";
    import { transcriptionDisabled, runMediaTranscription } from "../../states/commands";
    import Spinner from "../util/Spinner.svelte";
    import NiceLabel from "../util/NiceLabel.svelte";
    import taskAddIcon from "../../../resources/icons/carbon--task-add.svg?raw";
    import taskCompleteIcon from "../../../resources/icons/carbon--task-complete.svg?raw";
    import taskRemoveIcon from "../../../resources/icons/carbon--task-remove.svg?raw";
    import removeIcon from "../../../resources/icons/carbon--trash-can.svg?raw";
    import checkIcon from "../../../resources/icons/carbon--checkmark.svg?raw";
    import Tooltip from "../util/Tooltip.svelte";

    const { item }: { item: MediaItemState } = $props();
    const task = $derived(transcriptions.taskFor(item));
    let confirmingRemove = $state(false);
    let removeTooltipOpen = $state(false);
    let removeButton = $state<HTMLButtonElement>();

    const importStages = {
        queued: "等待导入",
        path: "正在读取文件路径",
        metadata: "正在读取媒体信息",
        hash: "正在计算哈希",
        locating: "正在选择媒体文件",
        ready: "导入完成"
    };

    $effect(() => {
        const locked = projectState.locked;
        if (item.stage === "ready" || locked) {
            confirmingRemove = false;
            removeTooltipOpen = false;
        }
    });

    $effect(() => {
        if (!confirmingRemove) return;
        const reset = (event: Event): void => {
            if (!removeButton || !event.composedPath().includes(removeButton)) confirmingRemove = false;
        };
        window.addEventListener("pointerdown", reset, true);
        window.addEventListener("click", reset, true);
        return () => {
            window.removeEventListener("pointerdown", reset, true);
            window.removeEventListener("click", reset, true);
        };
    });

    function handleRemove(event: MouseEvent): void {
        event.stopPropagation();
        if (projectState.locked) return;
        if (confirmingRemove) removeMedia(item);
        else {
            confirmingRemove = true;
            removeTooltipOpen = true;
        }
    }

    function getSemanticDuration(duration: number): string {
        if (duration < 60)
            return `00:${Math.round(duration).toString().padStart(2, "0")}`;
        else if (duration < 3600)
            return `${Math.floor(duration / 60).toString().padStart(2, "0")}:${Math.round(duration % 60).toString().padStart(2, "0")}`;
        else
            return `${Math.floor(duration / 3600)}:${Math.floor((duration % 3600) / 60).toString().padStart(2, "0")}:${Math.round(duration % 60).toString().padStart(2, "0")}`;
    }
</script>