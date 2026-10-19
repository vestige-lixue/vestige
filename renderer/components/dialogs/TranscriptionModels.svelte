<Modal bind:open={() => open, value => {
    if (value || beforeClose?.() !== false) open = value;
}} width="720px" height="80%" escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("transcription.models.title")}</Dialog.Title>
    <DownloadManager kind="model" {dialogId} bind:beforeClose />
</Modal>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import DownloadManager from "../downloads/DownloadManager.svelte";

    let { open = $bindable(), dialogId, onClosed }: { open: boolean; dialogId: string; onClosed: () => void } = $props();
    let beforeClose = $state<() => boolean>();
</script>