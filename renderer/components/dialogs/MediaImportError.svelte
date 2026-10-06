<Modal
    bind:open
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    onOpenChangeComplete={open => {
        if (!open) onClosed();
    }}
>
    <Dialog.Title class="modal-title">{i18n.t("dialogs.mediaImportFailed")}</Dialog.Title>
    <Dialog.Description class="modal-description">{i18n.t("dialogs.mediaImportDescription", { path: failure.path ?? failure.name ?? i18n.t("dialogs.droppedFile"), error: describeFailure(failure.error) })}</Dialog.Description>
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
    import * as mediaImport from "../../states/mediaImport.svelte";

    let { open = $bindable(), failure, onClosed }: {
        open: boolean;
        failure: mediaImport.MediaImportFailure;
        onClosed: () => void;
    } = $props();
</script>