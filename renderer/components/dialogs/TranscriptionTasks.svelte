<Modal bind:open escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed(nextAction);
}}>
    <Dialog.Title class="modal-title">转写任务</Dialog.Title>
    <div class="tasks">
        {#each tasks as task (task.id)}
            <div class="task">
                <span>{project.getMedia(task.mediaId)?.name ?? ""}</span>
                <span>{task.status === "failed" ? "失败" : task.status === "stopping" ? "正在停止" : "正在转写"}</span>
                <button class="hoverable activable" disabled={task.status === "stopping"} onclick={() => {
                    if (task.status === "failed") {
                        nextAction = () => onFailure(task.mediaId);
                        open = false;
                    }
                    else onStop(task.mediaId);
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
    import * as project from "../../states/project.svelte";
    import * as transcription from "../../states/transcription.svelte";

    let { open = $bindable(), tasks, onStop, onFailure, onClosed }: {
        open: boolean;
        tasks: transcription.TranscriptionTask[];
        onStop: (mediaId: string) => void;
        onFailure: (mediaId: string) => void;
        onClosed: (next?: () => void) => void;
    } = $props();
    let nextAction: (() => void) | undefined;
</script>