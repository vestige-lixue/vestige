<Modal bind:open width="80%" height="80%" escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("dialogs.vocabulary")}</Dialog.Title>
    {#snippet actions()}
        <button class="primary hoverable activable focusable" onclick={() => {
            open = false;
        }}>{i18n.t("common.close")}</button>
    {/snippet}
</Modal>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";

    let { open = $bindable(), onClosed }: { open: boolean; onClosed: () => void } = $props();
</script>