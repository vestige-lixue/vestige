<Modal bind:open width="min(90%, 800px)" escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("transcription.config.title")}</Dialog.Title>
    <Dialog.Description class="modal-description">{project.getMedia(mediaId)?.name ?? ""}</Dialog.Description>
    <div class="presetRow">
        <label for="transcription-preset">{i18n.t("transcription.config.preset.label")}</label>
        <div class="presetControl">
            <DropdownSelector id="transcription-preset" items={presetItems} value={selectedName} placeholder={i18n.t("transcription.config.preset.custom")} onValueChange={name => {
                const preset = presets.find(preset => preset.name === name);
                if (preset) applyPreset(preset.name, preset.config);
            }} />
            <Tooltip text={i18n.t("transcription.presets.actions.manage")} onclick={() => dialogsAPI.showTranscriptionPresets(dialogId, applyPreset, selectedName)}>
                {#snippet child({ props })}
                    <button {...props} class="edit icon-button hoverable activable focusable">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html settingsIcon}
                    </button>
                {/snippet}
            </Tooltip>
        </div>
    </div>
    <ConfigFields {dialogId} {config} onchange={value => {
        config = value; selectedName = "";
    }} bind:validate />
    {#snippet actions()}
        <TextButton class="primary" disabled={!settings.isReady() || project.projectState.locked || !mediaImport.isReady(mediaId)} onclick={start}>
            {i18n.t("transcription.config.submit")}
        </TextButton>
    {/snippet}
</Modal>


<style>
    .presetRow {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    label {
        font-weight: 600;
    }
    .presetControl {
        display: flex;
        gap: 8px;
    }
    .edit {
        width: 24px;
        padding: 6px;
        border: 1px solid var(--c-border);
        border-radius: 6px;
        color: var(--c-text);
        flex-shrink: 0;
    }
    .edit :global(svg) {
        width: 24px;
        height: 24px;
    }
</style>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import { onMount, untrack } from "svelte";
    import * as i18n from "../../i18n.svelte";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import DropdownSelector from "../util/DropdownSelector.svelte";
    import ConfigFields from "../transcription/ConfigFields.svelte";
    import * as project from "../../states/project.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as transcription from "../../states/transcription.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import { defaultConfig, type Config } from "../../../shared/transcription/Config";
    import { mergePresets } from "../../../shared/transcription/presets";
    import { validTranscriptionConfig } from "../../../shared/settings/validate";
    import settingsIcon from "../../../resources/icons/carbon--settings.svg?raw";
    import * as dialogsAPI from "../../states/dialogs";
    import * as settingsAPI from "../../states/settings";
    import * as transcriptionAPI from "../../states/transcription";

    type Props = { open: boolean; dialogId: string; mediaId: string; taskId?: string; onClosed: () => void };
    let { open = $bindable(), dialogId, mediaId, taskId, onClosed }: Props = $props();
    let config = $state<Config>(untrack(previousConfig));
    let selectedName = $state("");
    let validate = $state<(requireDirectory?: boolean, report?: boolean) => boolean>();
    const presets = $derived(mergePresets(settings.get()?.transcription.presets ?? {}));
    const presetItems = $derived(presets.map(preset => ({ value: preset.name, label: preset.name })));

    onMount(() => {
        void settingsAPI.initialize();
    });
    $effect(() => {
        if (selectedName && !presets.some(preset => preset.name === selectedName)) selectedName = "";
    });

    function previousConfig(): Config {
        const request = (taskId ? transcription.getTaskById(taskId) : transcription.getTask(mediaId))?.request;
        if (!request) return defaultConfig();
        try {
            const config = { executer: request.executer, backendDirectory: request.backendDirectory, modelDirectory: request.modelDirectory, params: JSON.parse(request.params) };
            return validTranscriptionConfig(config) ? config : defaultConfig();
        }
        catch {
            return defaultConfig();
        }
    }

    function applyPreset(name: string, preset: Config): void {
        config = { ...preset, params: { ...preset.params } };
        selectedName = name;
    }

    function start(): void {
        if (validate?.(true) !== true || project.projectState.locked) return;
        if (transcriptionAPI.start(mediaId, config)) open = false;
    }
</script>