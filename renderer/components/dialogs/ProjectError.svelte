<Modal
    bind:open={() => open && !projectState.locked, value => open = value}
    escBehavior="close"
    clickMaskBehavior="ignore"
    class="project-dialog"
    onOpenChangeComplete={isOpen => {
        if (!isOpen && !open) onClosed();
    }}
>
    <Dialog.Title class="modal-title">操作失败</Dialog.Title>
    <Dialog.Description class="modal-description">{message}</Dialog.Description>
    {#snippet actions()}
        <button class="primary hoverable activable" onclick={() => {
            open = false;
        }}>确定</button>
    {/snippet}
</Modal>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import { projectState } from "../../states/project.svelte";

    let { message, onClosed }: { message: string; onClosed: () => void } = $props();
    let open = $state(true);
</script>