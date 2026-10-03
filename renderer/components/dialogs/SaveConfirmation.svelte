<Modal
    bind:open
    class="save-confirmation"
    escBehavior="close"
    clickMaskBehavior="ignore"
    onOpenChangeComplete={isOpen => {
        if (!isOpen) answerSave(choice);
    }}
>
    <Dialog.Title class="modal-title">保存项目后再继续？</Dialog.Title>
    <Dialog.Description class="modal-description">“{saveConfirmation.fileName}”有未保存的更改。</Dialog.Description>
    {#snippet actions()}
        <button class="hoverable activable" onclick={() => choose("cancel")}>取消</button>
        <button class="discard hoverable activable" onclick={() => choose("discard")}>不保存</button>
        <button class="save primary hoverable activable" onclick={() => choose("save")}>保存</button>
    {/snippet}
</Modal>


<style>
    .discard {
        margin-right: auto;
    }
</style>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import { answerSave, saveConfirmation, type SaveChoice } from "../../states/confirmation.svelte";

    let open = $state(true);
    let choice: SaveChoice = "cancel";

    function choose(value: SaveChoice): void {
        if (!open) return;
        choice = value;
        open = false;
    }
</script>