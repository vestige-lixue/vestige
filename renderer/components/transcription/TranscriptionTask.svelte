<TaskItem value={task.id} class="transcription-task" bind:ref expandable={displayStatus !== "queued"}
    {progress} output={output.snapshot?.output ?? ""}
>
    {#snippet title()}{project.getMedia(task.mediaId)?.name ?? task.mediaName}{/snippet}
    {#snippet status()}<span class:danger={displayStatus === "failed"}>{i18n.t(`transcription.tasks.status.${displayStatus}`)}</span>{/snippet}
    {#snippet actions()}
        {#if transcription.isPending(task)}
            <TextButton disabled={task.status === "stopping"} onclick={onStop}>
                {i18n.t(displayStatus === "queued" ? "transcription.actions.cancelQueued" : task.status === "stopping" ? "transcription.tasks.status.stopping" : "transcription.actions.stop")}
            </TextButton>
        {:else}
            <TextButton disabled={!mediaImport.isReady(task.mediaId) || transcription.isPending(transcription.getTask(task.mediaId))} onclick={onRetry}>{i18n.t("common.retry")}</TextButton>
        {/if}
        {#if task.status !== "running" && task.status !== "stopping"}
            <TextButton class="danger" onclick={onRemove}>{i18n.t("transcription.tasks.actions.remove")}</TextButton>
        {/if}
    {/snippet}
    {#if displayStatus !== "queued"}
        {#if !output.snapshot}
            <div class="task-item-message">{i18n.t(output.loading ? "transcription.tasks.output.loading" : "transcription.tasks.output.unavailable")}</div>
        {/if}
        {#if task.status === "failed"}<div class="task-item-error error-message">{describeFailure(task.error)}</div>{/if}
        {#if output.error}<div class="task-item-error error-message">{describeFailure(output.error)}</div>{/if}
    {/if}
</TaskItem>


<script lang="ts">
    import { untrack } from "svelte";
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import * as project from "../../states/project.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as transcription from "../../states/transcription.svelte";
    import * as taskOutput from "../../states/taskOutput.svelte";
    import { describeFailure } from "../../failures";
    import TaskItem from "../util/TaskItem.svelte";

    let { task, ref = $bindable(null), busy = $bindable(false), onStop, onRetry, onRemove, onExpandableChange }: {
        task: transcription.TranscriptionTask;
        ref?: HTMLButtonElement | null;
        busy?: boolean;
        onStop: () => void;
        onRetry: () => void;
        onRemove: () => void;
        onExpandableChange?: (expandable: boolean) => void;
    } = $props();
    const outputTaskId = $derived(task.status === "queued" ? null : task.id);
    const output = taskOutput.observe(() => outputTaskId);
    const displayStatus = $derived(task.status === "running" && output.snapshot?.status === "queued" ? "queued" : task.status);
    const progress = $derived(displayStatus !== "queued"
        && (output.loading || output.snapshot && (output.snapshot.status === "running" || output.snapshot.progress !== null))
        ? output.snapshot?.progress ?? null : undefined);

    $effect(() => {
        busy = transcription.isPending(task);
    });
    $effect(() => {
        // Main may still have this renderer-running task in its admission queue.
        if (task.status === "running" && output.loading && !output.snapshot) return;
        const expandable = displayStatus !== "queued";
        untrack(() => onExpandableChange?.(expandable));
    });
</script>