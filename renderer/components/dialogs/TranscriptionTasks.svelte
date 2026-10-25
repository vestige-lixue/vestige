<Modal bind:open width="80%" height="80%" escBehavior="close" clickMaskBehavior="close" onOpenAutoFocus={() => {
    void tick().then(focusTask);
}} onOpenChangeComplete={isOpen => {
    if (!isOpen) onClosed(nextAction);
}}>
    <Dialog.Title class="modal-title">{i18n.t("transcription.tasks.title")}</Dialog.Title>
    <Accordion.Root type="multiple" bind:value={expanded} class="transcription-task-list">
        {#each tasks as task (task.id)}
            <TranscriptionTask {task} bind:ref={() => taskTriggers[task.id] ?? null, value => taskTriggers[task.id] = value}
                onExpandableChange={value => updateExpandable(task.id, value)} onStop={() => onStop(task.id)} onRemove={() => onRemove(task.id)} onRetry={() => {
                    nextAction = () => onRetry(task.id);
                    open = false;
                }} />
        {:else}
            <div>{i18n.t("transcription.tasks.empty")}</div>
        {/each}
    </Accordion.Root>
</Modal>


<style>
    :global(.transcription-task-list) {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
</style>


<script lang="ts">
    import { tick, untrack } from "svelte";
    import * as i18n from "../../i18n.svelte";
    import { Accordion, Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import TranscriptionTask from "../transcription/TranscriptionTask.svelte";
    import * as transcription from "../../states/transcription.svelte";

    let { open = $bindable(), tasks, focusTaskId, onStop, onRetry, onRemove, onClosed }: {
        open: boolean;
        tasks: transcription.TranscriptionTask[];
        focusTaskId?: string;
        onStop: (taskId: string) => void;
        onRetry: (taskId: string) => void;
        onRemove: (taskId: string) => void;
        onClosed: (next?: () => void) => void;
    } = $props();
    let expanded = $state<string[]>([]);
    let initialFocus = untrack(() => focusTaskId);
    let taskTriggers = $state<Record<string, HTMLButtonElement | null>>({});
    let nextAction: (() => void) | undefined;

    function updateExpandable(id: string, expandable: boolean): void {
        if (!expandable && expanded.includes(id)) expanded = expanded.filter(value => value !== id);
        if (initialFocus === id) {
            initialFocus = undefined;
            if (expandable && !expanded.includes(id)) expanded.push(id);
        }
    }

    function focusTask(): void {
        if (!open || !focusTaskId) return;
        const trigger = taskTriggers[focusTaskId];
        trigger?.focus({ preventScroll: true });
        trigger?.scrollIntoView({ block: "start", behavior: "instant" });
    }
</script>