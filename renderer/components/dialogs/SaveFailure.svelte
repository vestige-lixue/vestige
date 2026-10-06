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
    <Dialog.Title class="modal-title">{i18n.t("dialogs.saveFailed")}</Dialog.Title>
    <Dialog.Description class="modal-description">{i18n.t("dialogs.saveFailedDescription", { name: fileName ?? i18n.t("common.unsaved"), error: describeFailure(error) })}</Dialog.Description>
    {#snippet actions()}
        <button class="hoverable activable focusable" onclick={() => choose("retry")}>{i18n.t("common.retry")}</button>
        <button class="hoverable activable focusable" onclick={() => choose("memory")}>{i18n.t("dialogs.editInMemory")}</button>
        <button class="save primary hoverable activable focusable" onclick={() => choose("save")}>{i18n.t("dialogs.saveAs")}</button>
    {/snippet}
</Modal>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../feedback";
    import { Dialog } from "bits-ui";
    import { type Failure } from "../../../shared/failure";
    import Modal from "../util/Modal.svelte";
    import * as dialogs from "../../states/dialogs.svelte";

    let { open = $bindable(), fileName, error, answer, onClosed }: {
        open: boolean;
        fileName: string | null;
        error: Failure;
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