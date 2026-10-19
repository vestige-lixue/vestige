<Modal
    bind:open
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    onOpenChangeComplete={open => {
        if (!open) onClosed();
    }}
>
    <Dialog.Title class="modal-title">{i18n.t("media.import.failure.title")}</Dialog.Title>
    <Dialog.Description class="modal-description">{i18n.t("media.import.failure.description", { path: failure.path ?? failure.name ?? i18n.t("media.import.failure.droppedFile"), error: describeFailure(failure.error) })}</Dialog.Description>
    {#snippet actions()}
        <TextButton class="primary" onclick={() => {
            open = false;
        }}>{i18n.t("common.ok")}</TextButton>
    {/snippet}
</Modal>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../../failures";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";

    let { open = $bindable(), failure, onClosed }: {
        open: boolean;
        failure: mediaImport.MediaImportFailure;
        onClosed: () => void;
    } = $props();
</script>