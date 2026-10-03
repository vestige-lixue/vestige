<Modal bind:open escBehavior="close" clickMaskBehavior="ignore" onOpenChangeComplete={open => {
    if (!open) onClosed(nextDialog);
}}>
    <Dialog.Title class="modal-title">转写失败</Dialog.Title>
    <Dialog.Description class="modal-description">{`${item.vestige?.media.name ?? item.name}\n${transcriptions.taskFor(item)?.error ?? ""}`}</Dialog.Description>
    {#snippet actions()}
        <button class="hoverable activable" disabled={item.stage !== "ready" || item.ignored} onclick={() => {
            nextDialog = { kind: "transcription", item, open: true };
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
    import { type MediaItemState } from "../../states/media.svelte";
    import { type ApplicationDialog } from "../../states/interface.svelte";
    import { transcriptions } from "../../states/transcription.svelte";

    let { open = $bindable(false), item, onClosed }: {
        open?: boolean;
        item: MediaItemState;
        onClosed: (next?: ApplicationDialog) => void;
    } = $props();
    let nextDialog: ApplicationDialog | undefined;
</script>