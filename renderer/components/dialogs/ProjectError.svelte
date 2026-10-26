<Modal
    bind:open
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    class="project-dialog"
    onOpenChangeComplete={isOpen => {
        if (!isOpen) {
            if (quitting) onQuit?.();
            onClosed();
        }
    }}
>
    <Dialog.Title class="modal-title">{i18n.t(onQuit ? "project.quitWithImports.title" : "project.operationFailure.title")}</Dialog.Title>
    <Dialog.Description class="modal-description">{message}</Dialog.Description>
    {#snippet actions()}
        {#if onQuit}
            <TextButton onclick={() => {
                if (!open) return;
                quitting = true;
                open = false;
            }}>{i18n.t("project.quitWithImports.quit")}</TextButton>
        {/if}
        <TextButton class="primary" onclick={() => {
            open = false;
        }}>{i18n.t(onQuit ? "common.cancel" : "common.ok")}</TextButton>
    {/snippet}
</Modal>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../../failures";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import * as project from "../../states/project.svelte";

    let { open = $bindable(), error, onQuit, onClosed }: {
        open: boolean;
        error: project.ProjectError;
        onQuit?: () => void;
        onClosed: () => void;
    } = $props();
    let quitting = false;
    const message = $derived.by(() => {
        switch (error.kind) {
            case "pending-imports": return i18n.t(onQuit ? "project.quitWithImports.description" : "project.operationFailure.pendingImports");
            case "active-transcriptions": return i18n.t("project.operationFailure.activeTranscriptions");
            case "operation-failed": return describeFailure(error.failure);
            case "read-failed": return i18n.t("project.operationFailure.readFailed", { path: error.path, error: describeFailure(error.failure) });
        }
    });
</script>