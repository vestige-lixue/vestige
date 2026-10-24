<Modal bind:open={() => visible, value => {
    if (value) visible = true;
    else void close();
}} width="min(90%, 800px)" escBehavior="close" clickMaskBehavior="close" onkeydown={handleKeydown} onOpenChangeComplete={value => {
    if (!value && !visible) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("transcription.config.title")}</Dialog.Title>
    <Dialog.Description class="modal-description">{project.getMedia(mediaId)?.name ?? ""}</Dialog.Description>
    <div class="presetRow">
        <label for="transcription-preset">{i18n.t("transcription.config.preset.label")}</label>
        <div class="presetControl">
            <DropdownSelector id="transcription-preset" items={presetItems} value={selectedName} {disabled} placeholder={i18n.t("transcription.config.preset.custom")} onValueChange={name => {
                const preset = presets.find(preset => preset.name === name);
                if (preset) applyPreset(preset.name, preset.config);
            }} />
            <Tooltip text={i18n.t("transcription.presets.actions.manage")} {disabled} onclick={() => dialogsAPI.showTranscriptionPresets(dialogId, applyPreset, selectedName)}>
                {#snippet child({ props })}
                    <button {...props} class="edit icon-button hoverable activable focusable" {disabled}>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html settingsIcon}
                    </button>
                {/snippet}
            </Tooltip>
        </div>
    </div>
    <ConfigFields {dialogId} {config} {disabled} onchange={value => {
        config = value; selectedName = "";
    }} bind:validate />
    {#if failure}
        <div class="error-message">{i18n.t("settings.saveError", { error: describeFailure(failure) })}</div>
        <TextButton disabled={pending} onclick={() => void (initialized ? commit() : initialize())}>{i18n.t("common.retry")}</TextButton>
    {/if}
    {#snippet actions()}
        <TextButton class="primary" disabled={startDisabled} onclick={() => void close(true)}>
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
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as dialogs from "../../states/dialogs.svelte";
    import { defaultConfig, configsEqual, type Config } from "../../../shared/transcription/Config";
    import { mergePresets } from "../../../shared/transcription/presets";
    import { validTranscriptionConfig } from "../../../shared/settings/validate";
    import { describeFailure } from "../../failures";
    import settingsIcon from "../../../resources/icons/carbon--settings.svg?raw";
    import * as dialogsAPI from "../../states/dialogs";
    import * as settingsAPI from "../../states/settings";
    import * as transcriptionAPI from "../../states/transcription";

    type Props = { open: boolean; dialogId: string; mediaId: string; onClosed: () => void };
    let { open = $bindable(), dialogId, mediaId, onClosed }: Props = $props();
    let visible = $state(untrack(() => open));
    let config = $state<Config>(defaultConfig());
    let selectedName = $state("");
    let initialized = $state(false);
    let pending = $state(false);
    let closing = false;
    let alive = true;
    let commitTask: Promise<boolean> | null = null;
    let validate = $state<(requireDirectory?: boolean, report?: boolean) => boolean>();
    const disabled = $derived(!initialized || pending);
    const startDisabled = $derived(disabled || project.projectState.locked || !mediaImport.isReady(mediaId));
    const failure = $derived(settings.getError());
    const presets = $derived(mergePresets(settings.get()?.transcription.presets ?? {}));
    const presetItems = $derived(presets.map(preset => ({ value: preset.name, label: preset.name })));

    onMount(() => {
        void initialize();
        const unsubscribe = settingsAPI.beforeSave(commit);
        return () => {
            alive = false;
            unsubscribe();
        };
    });
    $effect(() => {
        if (open) visible = true;
        else if (visible && !pending) untrack(() => void close());
    });
    $effect(() => {
        if (selectedName && !presets.some(preset => preset.name === selectedName && configsEqual(preset.config, config))) selectedName = "";
    });

    function handleKeydown(event: KeyboardEvent): void {
        // Dropdowns consume Enter before it bubbles here, including the press that closes their list.
        if (event.key !== "Enter" || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat
            || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        if (!open || !visible || startDisabled || dialogs.state.dialogs.at(-1)?.id !== dialogId) return;
        const target = event.target;
        if (target !== event.currentTarget && (!(target instanceof HTMLInputElement) || target.type !== "text"
            || target.disabled || target.readOnly || !target.matches(".combobox-input, .parameters input"))) return;
        event.preventDefault();
        void close(true);
    }

    async function initialize(): Promise<void> {
        if (initialized || pending) return;
        pending = true;
        try {
            if (!await settingsAPI.initialize() || !alive) return;
            const previous = settings.get()!.transcription.lastConfig;
            if (previous) applyPreset(previous.presetName, previous.config);
            initialized = true;
        }
        finally {
            pending = false;
        }
    }

    function applyPreset(name: string, preset: Config): void {
        config = { ...preset, params: { ...preset.params } };
        selectedName = name;
    }

    function commit(): Promise<boolean> {
        if (!initialized) return Promise.resolve(true);
        if (commitTask) return commitTask;
        if (validate?.() !== true || !validTranscriptionConfig(config)) return Promise.resolve(false);
        const lastConfig = {
            config: { ...config, params: { ...config.params } },
            presetName: presets.some(preset => preset.name === selectedName && configsEqual(preset.config, config)) ? selectedName : ""
        };
        pending = true;
        const operation = settingsAPI.update({ transcription: { lastConfig } }, { save: true }).finally(() => {
            commitTask = null;
            pending = false;
        });
        commitTask = operation;
        return operation;
    }

    async function close(startTranscription = false): Promise<void> {
        if (closing || pending || !visible) return;
        if (startTranscription && (validate?.(true) !== true || project.projectState.locked)) return;
        closing = true;
        try {
            if (await commit() && (!startTranscription || transcriptionAPI.start(mediaId, config))) {
                visible = false;
                open = false;
            }
            else open = true;
        }
        finally {
            closing = false;
        }
    }
</script>