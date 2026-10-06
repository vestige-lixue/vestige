<Modal
    bind:open
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    class="project-dialog"
    onOpenChangeComplete={isOpen => {
        if (!isOpen) onClosed();
    }}
>
    <Dialog.Title class="modal-title">{i18n.t("dialogs.operationFailed")}</Dialog.Title>
    <Dialog.Description class="modal-description">{message}</Dialog.Description>
    {#snippet actions()}
        <button class="primary hoverable activable focusable" onclick={() => {
            open = false;
        }}>{i18n.t("common.ok")}</button>
    {/snippet}
</Modal>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../feedback";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import * as dialogs from "../../states/dialogs.svelte";

    let { open = $bindable(), error, onClosed }: {
        open: boolean;
        error: dialogs.ProjectError;
        onClosed: () => void;
    } = $props();
    const message = $derived.by(() => {
        switch (error.kind) {
            case "pending-imports": return i18n.t("dialogs.pendingImports");
            case "active-transcriptions": return i18n.t("dialogs.activeTranscriptions");
            case "operation-failed": return describeFailure(error.failure);
            case "read-failed": return i18n.t("dialogs.readFailed", { path: error.path, error: describeFailure(error.failure) });
        }
    });
</script>