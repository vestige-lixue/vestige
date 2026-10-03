<Modal bind:open escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">词库</Dialog.Title>
    {#snippet actions()}
        <button class="primary hoverable activable" onclick={() => {
            open = false;
        }}>关闭</button>
    {/snippet}
</Modal>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";

    let { open = $bindable(false), onClosed }: { open?: boolean; onClosed: () => void } = $props();
</script>