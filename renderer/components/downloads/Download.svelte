{#snippet downloadStatus()}
    {#if phase}<span class:danger={phase === "failed"}>{i18n.t(`downloads.status.${phase}`)}</span>{/if}
{/snippet}
<TaskItem value={download.id} class="download" expandable={!!taskId || !!failure} {progress}
    output={snapshot?.output ?? ""} status={phase ? downloadStatus : undefined}
>
    {#snippet title()}
        {download.name}<span class="size">{i18n.t("downloads.estimatedSize", { size: Math.round(download.estimatedBytes / 1024 ** 2) })}</span>
        {#if descriptionKey}<span class="model-description">{i18n.t(descriptionKey)}</span>{/if}
    {/snippet}
    {#snippet actions()}
        <TextButton bind:ref={actionButton} class={{ attention }}
            disabled={running || cancelling ? cancelling : installed || starting || !!taskId && loading}
            onblur={() => attention = false} onclick={() => void (running ? cancel() : start())}
        >
            {i18n.t(running || cancelling ? "common.cancel" : installed ? "downloads.status.installed" : "downloads.actions.download")}
        </TextButton>
    {/snippet}
    {#if snapshot?.status === "failed" && snapshot.error}
        <div class="task-item-error error-message">{describeFailure(snapshot.error)}</div>
    {/if}
    {#if output.error}<div class="task-item-error error-message">{describeFailure(output.error)}</div>{/if}
    {#if failure}<div class="task-item-error error-message">{failure}</div>{/if}
</TaskItem>


<style>
    .model-description {
        display: block;
        margin-top: 4px;
        color: var(--c-text-80p);
        font-size: 14px;
        font-weight: normal;
        line-height: 1.5;
    }
    .size {
        color: var(--c-text-80p);
        font-weight: normal;
        white-space: nowrap;
    }
    :global(.text-button.attention:focus) {
        outline: 2px solid var(--c-accent);
        outline-offset: 2px;
    }
</style>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import { untrack } from "svelte";
    import { type ParseKeys } from "i18next";
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../../failures";
    import { toFailureInfo } from "../../../shared/failure";
    import { type Download as DownloadInfo } from "../../../shared/downloads";
    import * as taskOutput from "../../states/taskOutput.svelte";
    import TaskItem from "../util/TaskItem.svelte";

    const modelDescriptions: Partial<Record<string, ParseKeys>> = {
        "whisper-tiny": "downloads.models.details.whisperTiny",
        "whisper-base": "downloads.models.details.whisperBase",
        "whisper-small": "downloads.models.details.whisperSmall",
        "whisper-large-v3": "downloads.models.details.whisperLargeV3",
        "whisper-large-v3-turbo": "downloads.models.details.whisperLargeV3Turbo",
        "sherpa-paraformer-zh": "downloads.models.details.paraformerZh",
        "sherpa-sense-voice-small-int8": "downloads.models.details.senseVoiceSmall",
        "sherpa-fire-red-asr2-ctc-int8": "downloads.models.details.fireRedAsr2Ctc",
        "sherpa-qwen3-asr-0.6b-int8": "downloads.models.details.qwen3Asr06b",
        "sherpa-qwen3-asr-1.7b-int8": "downloads.models.details.qwen3Asr17b"
    };

    type Props = {
        download: DownloadInfo;
        expanded: string[];
        busy?: boolean;
        focusCancel?: () => boolean;
    };
    let { download, expanded = $bindable(), busy = $bindable(false), focusCancel = $bindable() }: Props = $props();
    const descriptionKey = $derived(download.kind === "model" ? modelDescriptions[download.id] : undefined);
    let taskId = $state(untrack(() => download.taskId));
    const output = taskOutput.observe(() => taskId);
    const snapshot = $derived(output.snapshot);
    const loading = $derived(output.loading);
    const running = $derived(snapshot?.status === "running");
    const installed = $derived(download.installed || snapshot?.status === "succeeded");
    let starting = $state(false);
    let cancelling = $state(false);
    let failure = $state("");
    let actionButton = $state<HTMLButtonElement | null>(null);
    let attention = $state(false);
    const phase = $derived(cancelling ? "cancelling" : starting || !!taskId && loading ? "loading"
        : failure ? "failed" : snapshot?.status ?? (taskId ? "unavailable" : null));
    const progress = $derived(starting || !!taskId && loading ? null : snapshot?.progress ?? (running || cancelling ? null : undefined));

    $effect(() => {
        busy = starting || cancelling || running || !!taskId && loading;
    });
    $effect(() => {
        if (snapshot?.status === "failed" || output.error || failure) untrack(() => {
            if (!expanded.includes(download.id)) expanded = [...expanded, download.id];
        });
    });
    $effect(() => {
        focusCancel = () => {
            if (!running || !actionButton || actionButton.disabled) return false;
            attention = true;
            actionButton.focus();
            return true;
        };
    });

    async function start(): Promise<void> {
        if (starting) return;
        starting = true;
        failure = "";
        try {
            taskId = await window.api.downloads.start(download.kind, download.id);
        }
        catch (error) {
            failure = describeFailure(toFailureInfo(error));
        }
        finally {
            starting = false;
        }
    }

    async function cancel(): Promise<void> {
        if (!taskId || cancelling) return;
        cancelling = true;
        failure = "";
        try {
            await window.api.downloads.cancel(taskId);
        }
        catch (error) {
            failure = describeFailure(toFailureInfo(error));
        }
        finally {
            cancelling = false;
        }
    }
</script>