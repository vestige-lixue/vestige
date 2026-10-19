<Modal
    bind:open
    class="save-confirmation"
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    onOpenChangeComplete={isOpen => {
        if (!isOpen) {
            answer(choice);
            onClosed();
        }
    }}
>
    <Dialog.Title class="modal-title">{i18n.t("project.saveConfirmation.title")}</Dialog.Title>
    <Dialog.Description class="modal-description">{i18n.t("project.saveConfirmation.description", { name: fileName ?? i18n.t("project.unsaved.name") })}</Dialog.Description>
    {#snippet actions()}
        <TextButton hoverable={false} onclick={() => choose("cancel")}>{i18n.t("common.cancel")}</TextButton>
        <TextButton class="discard-btn" onclick={() => choose("discard")}>{i18n.t("project.saveConfirmation.discard")}</TextButton>
        <TextButton class="primary" onclick={() => choose("save")}>{i18n.t("common.save")}</TextButton>
    {/snippet}
</Modal>


<style>
    :global(.discard-btn) {
        margin-right: auto;
    }
</style>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import * as dialogs from "../../states/dialogs.svelte";

    let { open = $bindable(), fileName, answer, onClosed }: {
        open: boolean;
        fileName: string | null;
        answer: (choice: dialogs.SaveChoice) => void;
        onClosed: () => void;
    } = $props();
    let choice: dialogs.SaveChoice = "cancel";

    function choose(value: dialogs.SaveChoice): void {
        if (!open) return;
        choice = value;
        open = false;
    }
</script>