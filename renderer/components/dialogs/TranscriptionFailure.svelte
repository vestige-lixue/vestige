<Modal bind:open escBehavior="ignore" clickMaskBehavior="ignore" onOpenChangeComplete={open => {
    if (!open) onClosed(nextAction);
}}>
    <Dialog.Title class="modal-title">{i18n.t("dialogs.transcriptionFailed")}</Dialog.Title>
    <Dialog.Description class="modal-description">{`${project.getMedia(mediaId)?.name ?? ""}\n${describeFailure(error)}`}</Dialog.Description>
    {#snippet actions()}
        <button class="hoverable activable focusable" disabled={!mediaImport.isReady(mediaId)} onclick={() => {
            nextAction = onConfigure;
            open = false;
        }}>{i18n.t("transcription.configuration")}</button>
        <button class="primary hoverable activable focusable" onclick={() => {
            open = false;
        }}>{i18n.t("common.close")}</button>
    {/snippet}
</Modal>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../feedback";
    import { Dialog } from "bits-ui";
    import { type Failure } from "../../../shared/failure";
    import Modal from "../util/Modal.svelte";
    import * as project from "../../states/project.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";

    let { open = $bindable(), mediaId, error, onConfigure, onClosed }: {
        open: boolean;
        mediaId: string;
        error: Failure;
        onConfigure: () => void;
        onClosed: (next?: () => void) => void;
    } = $props();
    let nextAction: (() => void) | undefined;
</script>