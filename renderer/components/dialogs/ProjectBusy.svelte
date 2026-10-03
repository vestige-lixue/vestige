<Modal {open} escBehavior="ignore" clickMaskBehavior="ignore" class="project-dialog" onOpenChangeComplete={isOpen => {
    if (!isOpen && !projectState.locked) projectState.activity = null;
}}>
    <div class="heading">
        <Spinner size="20px" />
        <Dialog.Title class="modal-title">{projectState.activity?.title ?? "正在处理项目"}</Dialog.Title>
    </div>
    <Dialog.Description class="modal-description">{projectState.activity?.detail ?? "请稍候"}</Dialog.Description>
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
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import Spinner from "../util/Spinner.svelte";
    import { projectState } from "../../states/project.svelte";
    import { saveConfirmation } from "../../states/confirmation.svelte";

    const open = $derived(projectState.locked && saveConfirmation.fileName === null);
</script>