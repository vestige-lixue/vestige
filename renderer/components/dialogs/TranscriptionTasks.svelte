<Modal bind:open width="80%" height="80%" escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed(nextAction);
}}>
    <Dialog.Title class="modal-title">{i18n.t("transcription.tasks")}</Dialog.Title>
    <div class="tasks">
        {#each tasks as task (task.id)}
            <div class="task">
                <span>{project.getMedia(task.mediaId)?.name ?? ""}</span>
                <span>{task.status === "failed" ? i18n.t("transcription.failed") : task.status === "stopping" ? i18n.t("transcription.stopping") : task.status === "queued" ? i18n.t("transcription.queued") : i18n.t("transcription.running")}</span>
                <button class="hoverable activable focusable" disabled={task.status === "stopping"} onclick={() => {
                    if (task.status === "failed") {
                        nextAction = () => onFailure(task.mediaId);
                        open = false;
                    }
                    else onStop(task.mediaId);
                }}>{task.status === "failed" ? i18n.t("transcription.review-failure") : task.status === "queued" ? i18n.t("transcription.cancel-queued") : i18n.t("transcription.stop")}</button>
            </div>
        {:else}
            <div>{i18n.t("transcription.empty")}</div>
        {/each}
    </div>
    {#snippet actions()}
        <button class="primary hoverable activable focusable" onclick={() => {
            open = false;
        }}>{i18n.t("common.close")}</button>
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
    import * as i18n from "../../i18n.svelte";
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