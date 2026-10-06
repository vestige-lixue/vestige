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
    <Dialog.Title class="modal-title">{i18n.t("dialogs.saveConfirm")}</Dialog.Title>
    <Dialog.Description class="modal-description">{i18n.t("dialogs.unsavedChanges", { name: fileName ?? i18n.t("common.unsaved") })}</Dialog.Description>
    {#snippet actions()}
        <button class="activable focusable" onclick={() => choose("cancel")}>{i18n.t("common.cancel")}</button>
        <button class="discard-btn hoverable activable focusable" onclick={() => choose("discard")}>{i18n.t("common.discard")}</button>
        <button class="primary hoverable activable focusable" onclick={() => choose("save")}>{i18n.t("common.save")}</button>
    {/snippet}
</Modal>


<style>
    .discard-btn {
        margin-right: auto;
    }
</style>


<script lang="ts">
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