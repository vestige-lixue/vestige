<Modal bind:this={modal} bind:open width="540px" escBehavior="close" clickMaskBehavior="close" onkeydown={handleKeydown}
    onOpenAutoFocus={() => (initialSource ? replacementInput : sourceInput)?.focus({ preventScroll: true })}
    onOpenChangeComplete={value => {
        if (!value) onClosed();
    }}>
    <Dialog.Title class="modal-title">{i18n.t(rule ? "transcription.vocabulary.editRule" : "transcription.vocabulary.add")}</Dialog.Title>
    <form id={dialogId} oninput={() => failure = null} onsubmit={event => {
        event.preventDefault();
        void save();
    }}>
        <div class="field">
            <label class="field-label" for={dialogId + "-source"}>{i18n.t("transcription.vocabulary.source")}</label>
            <textarea id={dialogId + "-source"} class="input-control focusable" bind:this={sourceInput} bind:value={sourceText}
                readonly={pending || !open} rows="2" spellcheck={false}></textarea>
        </div>
        <div class="field">
            <label class="field-label" for={dialogId + "-replacement"}>{i18n.t("transcription.vocabulary.replacement")}</label>
            <textarea id={dialogId + "-replacement"} class="input-control focusable" bind:this={replacementInput} bind:value={replacement}
                readonly={pending || !open} rows="2" spellcheck={false}></textarea>
        </div>
        {#if message}<div class="error-message" role="alert">{message}</div>{/if}
    </form>
    {#snippet actions()}
        <TextButton type="submit" form={dialogId} class="primary" disabled={pending || !open}>{i18n.t("common.save")}</TextButton>
    {/snippet}
</Modal>

<style>
    form { display: flex; flex-direction: column; gap: 20px; }
    .field { display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 14px; }
    textarea { width: 100%; padding: 8px 10px; line-height: 1.6; resize: vertical; min-height: 64px; }
</style>

<script lang="ts">
    import { untrack } from "svelte";
    import { Dialog } from "bits-ui";
    import { type VocabularyRule, vocabularyRuleIssue } from "../../../shared/vocabulary/Vocabulary";
    import { type FailureInfo } from "../../../shared/failure";
    import * as i18n from "../../i18n.svelte";
    import * as vocabulary from "../../states/vocabulary.svelte";
    import * as vocabularyAPI from "../../states/vocabulary";
    import { describeFailure } from "../../failures";
    import Modal from "../util/Modal.svelte";
    import TextButton from "../util/TextButton.svelte";

    let { open = $bindable(), dialogId, rule, source = "", initialReplacement = "", onClosed }: {
        open: boolean; dialogId: string; rule?: VocabularyRule; source?: string; initialReplacement?: string; onClosed: () => void;
    } = $props();
    const id = untrack(() => rule?.id ?? crypto.randomUUID());
    const initialSource = untrack(() => rule?.source ?? source);
    let sourceText = $state(initialSource);
    let replacement = $state(untrack(() => rule?.replacement ?? initialReplacement));
    let pending = $state(false);
    let failure = $state<FailureInfo | ReturnType<typeof vocabularyRuleIssue>>(null);
    const message = $derived(typeof failure === "string" ? i18n.t(`transcription.vocabulary.errors.${failure}`) : failure && describeFailure(failure));
    let modal: ReturnType<typeof Modal> | undefined;
    let sourceInput: HTMLTextAreaElement;
    let replacementInput: HTMLTextAreaElement;

    type RuleText = Pick<VocabularyRule, "source" | "replacement">;
    function sameText(left: RuleText | undefined, right: RuleText | undefined): boolean {
        return left?.source === right?.source && left?.replacement === right?.replacement;
    }

    function closeAfterSave(): void {
        modal?.approveClose(rule ? { focusVisible: false } : undefined);
    }

    function focusInvalid(input: HTMLTextAreaElement): void {
        input.focus({ preventScroll: true });
        input.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (event.key !== "Enter" || event.defaultPrevented || event.isComposing || event.keyCode === 229
            || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        if (event.target !== event.currentTarget && !(event.target instanceof HTMLTextAreaElement)) return;
        event.preventDefault();
        if (!event.repeat) void save();
    }

    async function save(): Promise<void> {
        if (!open || pending) return;
        const draft = { source: sourceText, replacement };
        const issue = vocabularyRuleIssue(draft);
        if (issue) {
            failure = issue;
            focusInvalid(issue === "emptySource" || issue === "multilineSource" ? sourceInput : replacementInput);
            return;
        }

        const stored = vocabulary.getSnapshot().rules.find(item => item.id === id);
        if (sameText(draft, rule) || sameText(draft, stored)) {
            closeAfterSave();
            return;
        }
        if (!sameText(stored, rule)) {
            failure = { kind: "vocabulary-conflict" };
            focusInvalid(sourceInput);
            return;
        }

        pending = true;
        try {
            const result = await vocabularyAPI.change({ kind: "save", rule: { id, ...draft, enabled: stored?.enabled ?? true } });
            if (!open) return;
            if (result.success) closeAfterSave();
            else {
                failure = result.error;
                if (result.error.kind === "vocabulary-duplicate-rule") focusInvalid(sourceInput);
            }
        }
        finally {
            pending = false;
        }
    }
</script>