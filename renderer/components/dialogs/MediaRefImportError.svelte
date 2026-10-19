<Modal
    bind:open
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    onOpenChangeComplete={isOpen => {
        if (!isOpen) onClosed(action);
    }}
>
    <Dialog.Title class="modal-title">{labels[issue.status]}</Dialog.Title>
    <Dialog.Description class="modal-description">{description}</Dialog.Description>
    {#snippet actions()}
        <TextButton onclick={() => close(onRetry)}>{i18n.t("common.retry")}</TextButton>
        <TextButton class="primary" onclick={() => close(onRelink)}>{i18n.t("media.reference.actions.relocate")}</TextButton>
        <TextButton onclick={() => close(onIgnore)}>{i18n.t("media.reference.actions.ignore")}</TextButton>
    {/snippet}
</Modal>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../../failures";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import { type MediaIssueStatus } from "../../../shared/media/check";
    import * as dialogs from "../../states/dialogs.svelte";
    import * as project from "../../states/project.svelte";

    let { open = $bindable(), issue, onRetry, onRelink, onIgnore, onClosed }: {
        open: boolean;
        issue: dialogs.MediaRefImportIssue;
        onRetry: () => void;
        onRelink: () => void;
        onIgnore: () => void;
        onClosed: (next?: () => void) => void;
    } = $props();
    let action: (() => void) | undefined;

    const labels = $derived<Record<MediaIssueStatus, string>>({
        missing: i18n.t("media.reference.failure.title.missing"),
        changed: i18n.t("media.reference.failure.title.changed"),
        unreadable: i18n.t("media.reference.failure.title.unreadable")
    });

    function close(next: () => void): void {
        if (!open) return;
        action = next;
        open = false;
    }
    const description = $derived.by(() => {
        const { mediaId, path } = issue;
        const media = project.getMedia(mediaId);
        const original = !media || path === media.path ? "" : i18n.t("media.reference.failure.originalPath", { path: media.path });
        const guidance = issue.status === "changed"
            ? i18n.t("media.reference.failure.guidance.sameContent")
            : i18n.t("media.reference.failure.guidance.restoreFile");
        return i18n.t("media.reference.failure.description", { path, original, error: describeFailure(issue.error), guidance });
    });
</script>