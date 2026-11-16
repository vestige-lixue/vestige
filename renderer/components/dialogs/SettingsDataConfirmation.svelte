<Modal bind:open escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={isOpen => {
    if (!isOpen) {
        answer(confirmed);
        onClosed();
    }
}}>
    <Dialog.Title class="modal-title">{i18n.t(`settings.general.data.${mode}Title`)}</Dialog.Title>
    <Dialog.Description class="modal-description">{i18n.t(`settings.general.data.${mode}Description`, { name })}</Dialog.Description>
    {#snippet actions()}
        <TextButton hoverable={false} onclick={() => open = false}>{i18n.t("common.cancel")}</TextButton>
        <TextButton class="primary" onclick={() => {
            if (!open) return;
            confirmed = true;
            open = false;
        }}>{i18n.t(`settings.general.data.${mode}Confirm`)}</TextButton>
    {/snippet}
</Modal>

<script lang="ts">
    import { Dialog } from "bits-ui";
    import * as i18n from "../../i18n.svelte";
    import Modal from "../util/Modal.svelte";
    import TextButton from "../util/TextButton.svelte";

    let { open = $bindable(), mode, name = "", answer, onClosed }: {
        open: boolean;
        mode: "reset" | "import";
        name?: string;
        answer: (confirmed: boolean) => void;
        onClosed: () => void;
    } = $props();
    let confirmed = false;
</script>