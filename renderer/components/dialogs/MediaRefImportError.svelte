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
        <button class="hoverable activable focusable" onclick={() => close(onRetry)}>{i18n.t("common.retry")}</button>
        <button class="primary hoverable activable focusable" onclick={() => close(onRelink)}>{i18n.t("common.relocate")}</button>
        <button class="hoverable activable focusable" onclick={() => close(onIgnore)}>{i18n.t("common.ignore")}</button>
    {/snippet}
</Modal>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../feedback";
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
        missing: i18n.t("dialogs.mediaMissing"),
        changed: i18n.t("dialogs.mediaChanged"),
        unreadable: i18n.t("dialogs.mediaUnreadable")
    });

    function close(next: () => void): void {
        if (!open) return;
        action = next;
        open = false;
    }
    const description = $derived.by(() => {
        const { mediaId, path } = issue;
        const media = project.getMedia(mediaId);
        const original = !media || path === media.path ? "" : i18n.t("dialogs.originalPath", { path: media.path });
        const guidance = issue.status === "changed"
            ? i18n.t("dialogs.sameMedia")
            : i18n.t("dialogs.restoreMedia");
        return i18n.t("dialogs.mediaRefDescription", { path, original, error: describeFailure(issue.error), guidance });
    });
</script>