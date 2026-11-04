<Modal bind:open escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={isOpen => {
    if (!isOpen) onClosed(confirmed ? onConfirm : undefined);
}}>
    <Dialog.Title class="modal-title">{i18n.t("media.removeConfirmation.title", { name: mediaImport.getName(mediaId) })}</Dialog.Title>
    <Dialog.Description class="modal-description">{i18n.t("media.removeConfirmation.description")}</Dialog.Description>
    {#snippet actions()}
        <TextButton hoverable={false} onclick={() => open = false}>{i18n.t("common.cancel")}</TextButton>
        <TextButton class="primary" onclick={() => {
            if (!open) return;
            confirmed = true;
            open = false;
        }}>{i18n.t("media.actions.remove")}</TextButton>
    {/snippet}
</Modal>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import * as i18n from "../../i18n.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import Modal from "../util/Modal.svelte";
    import TextButton from "../util/TextButton.svelte";

    let { open = $bindable(), mediaId, onConfirm, onClosed }: {
        open: boolean;
        mediaId: string;
        onConfirm: () => void;
        onClosed: (next?: () => void) => void;
    } = $props();
    let confirmed = false;
</script>