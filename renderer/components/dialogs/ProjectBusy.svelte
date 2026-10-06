<Modal bind:open escBehavior="ignore" clickMaskBehavior="ignore" class="project-dialog" onOpenChangeComplete={isOpen => {
    if (!isOpen) onClosed();
}}>
    <div class="heading">
        <Spinner size="20px" />
        <Dialog.Title class="modal-title">{title}</Dialog.Title>
    </div>
    <Dialog.Description class="modal-description">{detail}</Dialog.Description>
</Modal>


<style>
    .heading {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }
    .heading :global(.modal-title) {
        margin: 0;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import Spinner from "../util/Spinner.svelte";
    import * as dialogs from "../../states/dialogs.svelte";

    let { open = $bindable(), operation, onClosed }: {
        open: boolean;
        operation: dialogs.ProjectOperation;
        onClosed: () => void;
    } = $props();

    const title = $derived.by(() => {
        switch (operation.kind) {
            case "new": return i18n.t("project.busy.new");
            case "close": return i18n.t("project.busy.close");
            case "quit": return i18n.t("project.busy.quit");
            case "open": return i18n.t("project.busy.open");
            case "read": return i18n.t("project.busy.read");
            case "save": return i18n.t("project.busy.save");
            case "wait-save": return i18n.t("project.busy.wait-save");
        }
    });
    const detail = $derived.by(() => {
        switch (operation.kind) {
            case "new": case "close": case "quit": return "";
            case "open": return operation.path ?? i18n.t("project.chooseFile");
            case "read": return operation.path;
            case "save": return operation.saveAs || operation.path === null ? i18n.t("project.chooseSaveLocation") : operation.path;
            case "wait-save": return operation.fileName ?? i18n.t("common.unsaved");
        }
    });
</script>