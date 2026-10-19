<Modal bind:open escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={isOpen => {
    if (!isOpen) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("transcript.switchRun.title")}</Dialog.Title>
    <Dialog.Description class="modal-description">{i18n.t("transcript.switchRun.description")}</Dialog.Description>
    {#snippet actions()}
        <TextButton hoverable={false} onclick={() => open = false}>{i18n.t("common.cancel")}</TextButton>
        <TextButton class="primary" onclick={() => {
            onConfirm();
            open = false;
        }}>{i18n.t("transcript.switchRun.confirm")}</TextButton>
    {/snippet}
</Modal>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";

    let { open = $bindable(), onConfirm, onClosed }: {
        open: boolean;
        onConfirm: () => void;
        onClosed: () => void;
    } = $props();
</script>