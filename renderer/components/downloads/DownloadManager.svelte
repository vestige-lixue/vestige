<div class="introduction">
    <div class="description">
        <LocalizedText text={i18n.t(kind === "model" ? "downloads.models.description" : "downloads.backends.description")} slots={{ guide: guideAction }} />
        {#snippet guideAction()}<button class="link-button focusable" onclick={() => dialogs.show({ kind: "guide", parentId: dialogId, onClosed: () => {} })}>{i18n.t("guide.title")}</button>{/snippet}
    </div>
    <TextButton class="openDirectory" disabled={opening} onclick={() => void openDirectory()}>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html externalLink}
        {i18n.t(kind === "model" ? "downloads.models.actions.openDirectory" : "downloads.backends.actions.openDirectory")}
    </TextButton>
</div>
<h2 class="section-title">{i18n.t(kind === "model" ? "downloads.models.title" : "downloads.backends.title")}</h2>
{#if loading}
    <div>{i18n.t("downloads.loading")}</div>
{:else}
    <Accordion.Root type="multiple" bind:value={expanded} class="download-list">
        {#each rows as row (row.download.id)}
            <Download download={row.download} bind:expanded bind:busy={row.busy} bind:focusCancel={row.focusCancel} />
        {/each}
    </Accordion.Root>
    {#if !rows.length}<div>{i18n.t("downloads.empty")}</div>{/if}
{/if}
{#if failure}<div class="error-message">{failure}</div>{/if}


<style>
    .introduction {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 16px;
    }
    .introduction :global(.openDirectory) {
        flex-shrink: 0;
    }
    .description {
        flex: 1 1 280px;
        min-width: 0;
        font-size: 16px;
        line-height: 1.6;
        overflow-wrap: anywhere;
    }
    .description button {
        text-underline-offset: .2em;
    }
    :global(.download-list) {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
</style>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import { onMount } from "svelte";
    import { Accordion } from "bits-ui";
    import * as i18n from "../../i18n.svelte";
    import * as dialogs from "../../states/dialogs.svelte";
    import { describeFailure } from "../../failures";
    import { toFailureInfo } from "../../../shared/failure";
    import { type Download as DownloadInfo, type DownloadKind } from "../../../shared/downloads";
    import LocalizedText from "../util/LocalizedText.svelte";
    import Download from "./Download.svelte";
    import externalLink from "../../../resources/icons/cil--external-link.svg?raw";

    type Row = { download: DownloadInfo; busy: boolean; focusCancel?: () => boolean };
    let { kind, dialogId, beforeClose = $bindable() }: {
        kind: DownloadKind;
        dialogId: string;
        beforeClose?: () => boolean;
    } = $props();
    let rows = $state<Row[]>([]);
    let expanded = $state<string[]>([]);
    let opening = $state(false);
    let loading = $state(true);
    let failure = $state("");

    onMount(() => {
        let disposed = false;
        beforeClose = () => {
            if (!loading && !rows.some(row => row.busy)) return true;
            rows.some(row => row.busy && row.focusCancel?.());
            return false;
        };
        void window.api.downloads.list().then(result => {
            if (!disposed) rows = result.filter(download => download.kind === kind).map(download => ({ download, busy: !!download.taskId }));
        }).catch(error => {
            if (!disposed) failure = describeFailure(toFailureInfo(error));
        }).finally(() => {
            if (!disposed) loading = false;
        });
        return () => {
            disposed = true;
            beforeClose = undefined;
        };
    });

    async function openDirectory(): Promise<void> {
        opening = true;
        try {
            await window.api.downloads.openDirectory(kind);
        }
        catch (error) {
            failure = describeFailure(toFailureInfo(error));
        }
        finally {
            opening = false;
        }
    }
</script>