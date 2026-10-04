<Modal bind:open escBehavior="close" clickMaskBehavior="ignore" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">转写配置</Dialog.Title>
    <Dialog.Description class="modal-description">{project.getMedia(mediaId)?.name ?? ""}</Dialog.Description>
    {#snippet actions()}
        <button class="primary hoverable activable" onclick={() => {
            open = false;
        }}>关闭</button>
    {/snippet}
</Modal>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import * as project from "../../states/project.svelte";

    let { open = $bindable(), mediaId, onClosed }: {
        open: boolean;
        mediaId: string;
        onClosed: () => void;
    } = $props();
</script>