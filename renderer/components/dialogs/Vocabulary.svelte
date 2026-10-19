<Modal bind:open width="80%" height="80%" escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("transcription.vocabulary.title")}</Dialog.Title>
</Modal>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";

    let { open = $bindable(), onClosed }: { open: boolean; onClosed: () => void } = $props();
</script>