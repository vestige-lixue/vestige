<Modal bind:open escBehavior="close" clickMaskBehavior="ignore" onOpenChangeComplete={open => {
    if (!open) onClosed(nextAction);
}}>
    <Dialog.Title class="modal-title">转写失败</Dialog.Title>
    <Dialog.Description class="modal-description">{`${project.getMedia(mediaId)?.name ?? ""}\n${error}`}</Dialog.Description>
    {#snippet actions()}
        <button class="hoverable activable" disabled={!mediaImport.isReady(mediaId)} onclick={() => {
            nextAction = onConfigure;
            open = false;
        }}>转写配置</button>
        <button class="primary hoverable activable" onclick={() => {
            open = false;
        }}>关闭</button>
    {/snippet}
</Modal>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import * as project from "../../states/project.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";

    let { open = $bindable(), mediaId, error, onConfigure, onClosed }: {
        open: boolean;
        mediaId: string;
        error: string;
        onConfigure: () => void;
        onClosed: (next?: () => void) => void;
    } = $props();
    let nextAction: (() => void) | undefined;
</script>