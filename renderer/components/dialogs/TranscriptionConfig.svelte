<Modal bind:open width="80%" height="80%" escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("transcription.configuration")}</Dialog.Title>
    <Dialog.Description class="modal-description">{project.getMedia(mediaId)?.name ?? ""}</Dialog.Description>
    {#snippet actions()}
        <button class="primary hoverable activable focusable" onclick={() => {}}>{i18n.t("transcription.start")}</button>
    {/snippet}
</Modal>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import * as project from "../../states/project.svelte";
    type Props = {
        open: boolean;
        mediaId: string;
        onClosed: () => void;
    };

    let { open = $bindable(), mediaId, onClosed }: Props = $props();
</script>