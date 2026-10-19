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
    <Dialog.Title class="modal-title">{i18n.t("project.saveFailure.title")}</Dialog.Title>
    <Dialog.Description class="modal-description">{i18n.t("project.saveFailure.description", { name: fileName ?? i18n.t("project.unsaved.name"), error: describeFailure(error) })}</Dialog.Description>
    {#snippet actions()}
        <TextButton onclick={() => choose("retry")}>{i18n.t("common.retry")}</TextButton>
        <TextButton onclick={() => choose("memory")}>{i18n.t("project.saveFailure.actions.editInMemory")}</TextButton>
        <TextButton class="save primary" onclick={() => choose("save")}>{i18n.t("project.saveFailure.actions.saveAs")}</TextButton>
    {/snippet}
</Modal>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../../failures";
    import { Dialog } from "bits-ui";
    import { type FailureInfo } from "../../../shared/failure";
    import Modal from "../util/Modal.svelte";
    import * as dialogs from "../../states/dialogs.svelte";

    let { open = $bindable(), fileName, error, answer, onClosed }: {
        open: boolean;
        fileName: string | null;
        error: FailureInfo;
        answer: (choice: dialogs.SaveChoice) => void;
        onClosed: () => void;
    } = $props();
    let choice: dialogs.SaveChoice = "retry";

    function choose(value: dialogs.SaveChoice): void {
        if (!open) return;
        choice = value;
        open = false;
    }
</script>