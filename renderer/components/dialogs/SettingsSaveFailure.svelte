<Modal bind:open escBehavior="close" clickMaskBehavior="ignore" onOpenChangeComplete={isOpen => {
    if (!isOpen) {
        answer(choice);
        onClosed();
    }
}}>
    <Dialog.Title class="modal-title">{i18n.t(`settings.${purpose === "quit" ? "quitFailure" : "closeFailure"}.title`)}</Dialog.Title>
    <Dialog.Description class="modal-description">{i18n.t(`settings.${purpose === "quit" ? "quitFailure" : "closeFailure"}.description`, { error: describeFailure(error) })}</Dialog.Description>
    {#snippet actions()}
        <TextButton onclick={() => choose("discard")}>{i18n.t(purpose === "quit" ? "settings.quitFailure.discard" : "settings.closeFailure.close")}</TextButton>
        {#if purpose === "quit"}<TextButton onclick={() => choose("cancel")}>{i18n.t("settings.quitFailure.cancel")}</TextButton>{/if}
        <TextButton class="primary" onclick={() => choose("retry")}>{i18n.t("common.retry")}</TextButton>
    {/snippet}
</Modal>

<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../../failures";
    import { type FailureInfo } from "../../../shared/failure";
    import * as dialogs from "../../states/dialogs.svelte";

    let { open = $bindable(), purpose, error, answer, onClosed }: {
        open: boolean;
        purpose: "close" | "quit";
        error: FailureInfo;
        answer: (choice: dialogs.SettingsSaveChoice) => void;
        onClosed: () => void;
    } = $props();
    let choice: dialogs.SettingsSaveChoice = "cancel";

    function choose(value: dialogs.SettingsSaveChoice): void {
        if (!open) return;
        choice = value;
        open = false;
    }
</script>