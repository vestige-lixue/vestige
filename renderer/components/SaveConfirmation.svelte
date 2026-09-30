<dialog bind:this={dialog} oncancel={event => {
    event.preventDefault();
    answerSave("cancel");
}}>
    <h2>保存项目后再继续？</h2>
    <p>“{saveConfirmation.fileName}”有未保存的更改。</p>
    <div class="actions">
        <button class="hoverable" onclick={() => answerSave("cancel")}>取消</button>
        <button class="discard hoverable" onclick={() => answerSave("discard")}>不保存</button>
        <button class="save hoverable" autofocus onclick={() => answerSave("save")}>保存</button>
    </div>
</dialog>

<style>
    dialog {
        --bg: var(--c-background);
        width: min(420px, calc(100vw - 48px));
        padding: 24px;
        border: 1px solid var(--c-border);
        border-radius: 12px;
        color: var(--c-text);
        background: var(--bg);
        box-shadow: 0 8px 32px var(--c-shadow-3);
        -webkit-app-region: no-drag;
    }
    dialog::backdrop {
        background: #0005;
    }
    h2 {
        margin: 0 0 12px;
        font-size: 18px;
    }
    p {
        margin: 0;
        overflow-wrap: anywhere;
        color: var(--c-muted);
        line-height: 1.6;
    }
    .actions {
        display: flex;
        gap: 8px;
        margin-top: 24px;
    }
    button {
        --bg: var(--c-surface);
        padding: 8px 14px;
        border: 1px solid var(--c-border);
        border-radius: 6px;
        background: var(--bg);
    }
    button:focus-visible {
        outline: 2px solid var(--c-text);
        outline-offset: 2px;
    }
    .discard {
        margin-right: auto;
    }
    .save {
        --bg: var(--c-text);
        color: var(--c-background);
    }
</style>

<script lang="ts">
    import { answerSave, saveConfirmation } from "../states/confirmation.svelte";

    let dialog: HTMLDialogElement;
    $effect(() => {
        if (saveConfirmation.fileName !== null) dialog.showModal();
        else dialog.close();
    });
</script>