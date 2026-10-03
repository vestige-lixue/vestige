<Modal bind:open escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed(nextDialog);
}}>
    <Dialog.Title class="modal-title">转写任务</Dialog.Title>
    <div class="tasks">
        {#each transcriptions.tasks as task (task.id)}
            <div class="task">
                <span>{task.item.vestige?.media.name ?? task.item.name}</span>
                <span>{task.status === "failed" ? "失败" : task.status === "stopping" ? "正在停止" : "正在转写"}</span>
                <button class="hoverable activable" disabled={task.status === "stopping"} onclick={() => {
                    if (task.status === "failed") {
                        nextDialog = { kind: "failure", item: task.item, open: true };
                        open = false;
                    }
                    else transcriptions.stop(task.item);
                }}>{task.status === "failed" ? "失败详情" : "停止转写"}</button>
            </div>
        {:else}
            <p>暂无转写任务</p>
        {/each}
    </div>
    {#snippet actions()}
        <button class="primary hoverable activable" onclick={() => {
            open = false;
        }}>关闭</button>
    {/snippet}
</Modal>


<style>
    .tasks {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .task {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .task span:first-child {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
    }
    .task button {
        padding: 6px 10px;
        border: 1px solid var(--c-border);
        border-radius: 6px;
    }
</style>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import { type ApplicationDialog } from "../../states/interface.svelte";
    import { transcriptions } from "../../states/transcription.svelte";

    let { open = $bindable(false), onClosed }: {
        open?: boolean;
        onClosed: (next?: ApplicationDialog) => void;
    } = $props();
    let nextDialog: ApplicationDialog | undefined;
</script>