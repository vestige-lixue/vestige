<Modal bind:this={modal} bind:open width="min(90%, 760px)" escBehavior="close" clickMaskBehavior="close" {beforeClose}
    onOpenChangeComplete={value => {
        if (!value) onClosed();
    }}>
    <Dialog.Title class="modal-title">{i18n.t("transcript.export.title")}</Dialog.Title>
    <Dialog.Description class="modal-description">{vestige?.media.name ?? ""}</Dialog.Description>
    <form bind:this={form} id={dialogId} onsubmit={event => {
        event.preventDefault(); void save();
    }}>
        <h3 id={dialogId + "-content"}>{i18n.t("transcript.export.content")}</h3>
        <div class="content">
            {@render choices(dialogId + "-content", source, [
                { value: "proofread", label: i18n.t("transcript.export.proofread") },
                { value: "run", label: i18n.t("transcript.export.original") }
            ], value => source = value)}
            <div class="run">
                <label class="visually-hidden" for={dialogId + "-run"}>{i18n.t("transcript.export.run")}</label>
                <DropdownSelector id={dialogId + "-run"} items={runItems} disabled={pending || source !== "run"}
                    bind:value={() => selectedRun?.id ?? "", value => {
                        if (source === "run") selectedRunId = value;
                    }} />
            </div>
        </div>
        <h3 id={dialogId + "-format"}>{i18n.t("transcript.export.format")}</h3>
        {@render choices(dialogId + "-format", format, [
            { value: "txt", label: i18n.t("transcript.export.txt") },
            { value: "srt", label: i18n.t("transcript.export.srt") }
        ], value => {
            if (value === "txt" || value === "srt") format = value;
        })}
        {#if format === "srt" && output.estimated}
            <div class="notice option-surface" role="status">{i18n.t("transcript.export.estimated")}</div>
        {/if}
        {#if source === "proofread" && format === "srt" && output.unanchored > 0}
            <div class="notice option-surface" role="status">{i18n.t("transcript.export.unanchored", { count: output.unanchored })}</div>
        {/if}
        {#if format === "srt"}
            <h3>{i18n.t("transcript.export.eachSubtitle")}</h3>
            <div class="description">{i18n.t("transcript.export.eachSubtitleDescription")}</div>
            {@render number("maxDurationSeconds", "transcript.export.longest", true, i18n.t("transcript.export.seconds"))}
            {@render number("maxLines", "transcript.export.maxLines", false, i18n.t("transcript.export.lines"))}
            {@render number("maxLineWidth", "transcript.export.lineWidth", true, undefined, "transcript.export.lineWidthDescription")}
            <h3>{i18n.t("transcript.export.newSubtitle")}</h3>
            <div class="description">{i18n.t("transcript.export.newSubtitleDescription")}</div>
            <div class="item">
                <label class="text" for={dialogId + "-splitAtLineBreaks"}>
                    <div class="label">{i18n.t("transcript.export.splitAtLineBreaks")}</div>
                </label>
                <Switch id={dialogId + "-splitAtLineBreaks"} bind:checked={splitAtLineBreaks} disabled={pending} />
            </div>
            <div class="item">
                <label class="text" for={dialogId + "-splitAtSentenceEnds"}>
                    <div class="label">{i18n.t("transcript.export.splitAtSentenceEnds")}</div>
                </label>
                <Switch id={dialogId + "-splitAtSentenceEnds"} bind:checked={splitAtSentenceEnds} disabled={pending} />
            </div>
            {@render number("pauseSeconds", "transcript.export.pause", true, i18n.t("transcript.export.seconds"), "transcript.export.pauseDescription")}
            <h3>{i18n.t("transcript.export.display")}</h3>
            {@render number("minDurationSeconds", "transcript.export.shortest", false, i18n.t("transcript.export.seconds"), "transcript.export.shortestDescription")}
        {/if}
    </form>
    {#if failure}<div class="error-message" role="alert">{describeFailure(failure)}</div>{/if}
    {#snippet actions()}
        {#if format === "srt"}
            <TextButton disabled={pending} onclick={resetOptions}>{i18n.t("transcript.export.reset")}</TextButton>
        {/if}
        <TextButton type="submit" form={dialogId} class="primary" disabled={pending || !selectedRun}>{i18n.t("transcript.export.submit")}</TextButton>
    {/snippet}
</Modal>

{#snippet choices(label: string, value: string, items: { value: string; label: string }[], onchange: (value: string) => void)}
    <RadioGroup.Root class="choices" aria-labelledby={label} orientation="horizontal" {value} onValueChange={onchange} disabled={pending}>
        {#each items as item (item.value)}
            <RadioGroup.Item value={item.value} class="choice text-button hoverable activable focusable">{item.label}</RadioGroup.Item>
        {/each}
    </RadioGroup.Root>
{/snippet}

{#snippet number(key: NumericKey, label: ParseKeys, nullable: boolean, unit?: string, description?: ParseKeys)}
    <div class="item">
        <label class="text" for={dialogId + "-" + key}>
            <div class="label">{i18n.t(label)}</div>
            {#if description}<div class="description" id={dialogId + "-" + key + "-description"}>{i18n.t(description)}</div>{/if}
        </label>
        <NumberInput class="exportNumber" id={dialogId + "-" + key} bind:value={draft[key]} disabled={pending} required={!nullable}
            aria-describedby={description ? dialogId + "-" + key + "-description" : undefined}
            min={srtLimits[key].min} max={srtLimits[key].max} step={key.endsWith("Seconds") ? "0.1" : "1"}
            placeholder={nullable ? i18n.t(key === "pauseSeconds" ? "transcript.export.noPauseSplit" : "transcript.export.unlimited") : undefined} {unit} />
    </div>
{/snippet}

<style>
    form { display: flex; flex-direction: column; gap: 24px; }
    h3 { margin: 8px 0 0; }
    .content { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .run { flex: 1 1 180px; min-width: 0; }
    .item { display: flex; align-items: center; gap: 16px; }
    .text { display: flex; flex: 1; flex-direction: column; gap: 8px; min-width: 0; }
    .label { line-height: 1.6; overflow-wrap: anywhere; }
    .description { color: var(--c-text-80p); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
    .item :global(.exportNumber) { flex: 0 0 160px; width: 160px; }
    :global(.choices) { display: flex; flex-wrap: wrap; gap: 8px; }
    :global(.choice[data-state="checked"]) { border-color: var(--c-accent); color: var(--c-accent); background: var(--c-surface); }
    .notice { padding: 12px; line-height: 1.6; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    @media (max-width: 480px) {
        .item { flex-wrap: wrap; }
        .item .text { flex-basis: 100%; }
    }
</style>

<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { Dialog, RadioGroup } from "bits-ui";
    import { type ParseKeys } from "i18next";
    import { type Settings } from "../../../shared/settings/Settings";
    import { defaultSettings } from "../../../shared/settings/defaults";
    import { srtLimits } from "../../../shared/constants";
    import { transcriptExportPath } from "../../../shared/export/TranscriptExport";
    import { type FailureInfo, toFailureInfo } from "../../../shared/failure";
    import { createTextIndex, projectText } from "../../../shared/transcript/text";
    import { exportPlainText, exportSrt, type SrtOptions } from "../../../shared/transcript/export";
    import * as i18n from "../../i18n.svelte";
    import * as project from "../../states/project.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as settingsAPI from "../../states/settings";
    import { describeFailure } from "../../failures";
    import Modal from "../util/Modal.svelte";
    import TextButton from "../util/TextButton.svelte";
    import DropdownSelector from "../util/DropdownSelector.svelte";
    import NumberInput from "../util/NumberInput.svelte";
    import Switch from "../util/Switch.svelte";

    let { open = $bindable(), dialogId, mediaId, runId, onClosed }: {
        open: boolean; dialogId: string; mediaId: string; runId?: string; onClosed: () => void;
    } = $props();
    type NumericKey = keyof typeof srtLimits;
    const initial = untrack(() => settings.getCurrent().export);
    let source = $state(untrack(() => runId ? "run" : "proofread"));
    let selectedRunId = $state(untrack(() => runId ?? project.getVestige(mediaId)?.runs[project.getVestige(mediaId)!.displayedRunIdx]?.id ?? ""));
    let format = $state<Settings["export"]["format"]>(initial.format);
    let splitAtLineBreaks = $state(initial.srt.splitAtLineBreaks);
    let splitAtSentenceEnds = $state(initial.srt.splitAtSentenceEnds);
    const draft = $state(Object.fromEntries(Object.keys(srtLimits).map(key => [key, initial.srt[key as NumericKey] ?? undefined])) as Record<NumericKey, number | undefined>);
    let pending = $state(false);
    let failure = $state<FailureInfo | null>(null);
    let form: HTMLFormElement;
    let modal: ReturnType<typeof Modal> | undefined;
    const vestige = $derived(project.getVestige(mediaId));
    const runItems = $derived(vestige?.runs.map((run, i) => ({ value: run.id, label: `#${i + 1} ${run.config.executor} / ${directoryName(run.config.modelDirectory)}` })) ?? []);
    const selectedRun = $derived(source === "proofread" ? vestige?.runs[vestige.displayedRunIdx] : vestige?.runs.find(run => run.id === selectedRunId));
    const index = $derived(createTextIndex(selectedRun?.transcript ?? []));
    const projection = $derived(projectText(index, source === "proofread" ? vestige?.modifications ?? [] : []));
    const options: SrtOptions = $derived.by(() => {
        const value = { ...initial.srt, splitAtLineBreaks, splitAtSentenceEnds };
        for (const key of Object.keys(srtLimits) as NumericKey[]) {
            const number = draft[key], limits = srtLimits[key];
            const nullable = key !== "maxLines" && key !== "minDurationSeconds";
            const valid = number !== undefined && Number.isFinite(number) && number >= limits.min && number <= limits.max
                && (key.endsWith("Seconds") || Number.isInteger(number));
            Object.assign(value, { [key]: valid ? number : number === undefined && nullable ? null : initial.srt[key] });
        }
        return value;
    });
    const output = $derived(format === "srt" ? exportSrt(index, projection, vestige?.media.duration ?? 0, options, selectedRun?.language) : { text: exportPlainText(index, projection), unanchored: 0, estimated: false });

    onMount(() => settingsAPI.registerDraft({ dialogId, commit }));

    function resetOptions(): void {
        if (pending) return;
        const defaults = defaultSettings.export.srt;
        splitAtLineBreaks = defaults.splitAtLineBreaks;
        splitAtSentenceEnds = defaults.splitAtSentenceEnds;
        for (const key of Object.keys(srtLimits) as NumericKey[]) draft[key] = defaults[key] ?? undefined;
        failure = null;
    }

    function directoryName(path: string): string {
        return path.split(path.startsWith("/") ? /\//u : /[\\/]/u).filter(Boolean).at(-1) ?? path;
    }

    async function commit(): Promise<boolean> {
        if (pending || !form.reportValidity()) return false;
        pending = true;
        try {
            const accepted = await settingsAPI.update({ export: { format, srt: { ...options } } });
            if (!accepted) failure = settings.getError();
            return accepted;
        }
        finally {
            pending = false;
        }
    }

    function beforeClose(): Promise<boolean> {
        return commit();
    }

    async function save(): Promise<void> {
        if (!open || pending || !selectedRun || !vestige) return;
        const request = { mediaId, format, content: output.text, defaultPath: transcriptExportPath(vestige.media.path, format) };
        failure = null;
        if (!await commit()) return;
        pending = true;
        try {
            const result = await window.api.exportTranscript(request);
            if (result?.success) modal?.approveClose();
            else if (result) failure = result.error;
        }
        catch (cause) {
            failure = toFailureInfo(cause);
        }
        finally {
            pending = false;
        }
    }
</script>