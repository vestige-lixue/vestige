<Modal bind:open escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">设置</Dialog.Title>
    <section class="about">
        <h3>关于 Vestige</h3>
        <p>本地媒体转写与校对工作空间</p>
    </section>
    {#snippet actions()}
        <button class="primary hoverable activable" onclick={() => {
            open = false;
        }}>关闭</button>
    {/snippet}
</Modal>


<style>
    .about h3 {
        margin: 0 0 8px;
        font-size: 16px;
    }
    .about p {
        margin: 0;
        color: var(--c-muted);
        line-height: 1.6;
        user-select: text;
    }
</style>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";

    let { open = $bindable(false), onClosed }: { open?: boolean; onClosed: () => void } = $props();
</script>