<div class="toolbar" onkeydown={toolbarKeydown}>
    {#each operations as operation (operation.key)}
        <Tooltip text={operation.text} disabled={pending || (operation.key === "copy" && !selected)}
            tabindex={toolbarTabStop === operation.index ? 0 : -1} onfocus={() => toolbarIndex = operation.index} onclick={operation.run}>
            {#snippet child({ props })}
                <button {...props} class="icon icon-button hoverable activable focusable" data-preset-action={operation.key}>
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html operation.icon}
                </button>
            {/snippet}
        </Tooltip>
    {/each}
    {#if selected && !selected.deletable}
        <Tooltip text={i18n.t("transcription.presets.builtinCannotRemove")} tabindex={-1}>
            {#snippet child({ props })}
                <div {...props} class="unavailableDelete">
                    <ConfirmDeleteButton text={i18n.t("transcription.presets.actions.remove")} onconfirm={remove} disabled size="32px" />
                </div>
            {/snippet}
        </Tooltip>
    {:else}
        <ConfirmDeleteButton text={i18n.t("transcription.presets.actions.remove")} onconfirm={remove} resetKey={selected} disabled={pending || !selected} size="32px"
            tabindex={toolbarTabStop === 2 ? 0 : -1} onfocus={() => toolbarIndex = 2} />
    {/if}
    {#if onApply}
        <div class="divider"></div>
        <Tooltip text={i18n.t("transcription.presets.actions.apply")} disabled={pending || !selected}
            tabindex={toolbarTabStop === 3 ? 0 : -1} onfocus={() => toolbarIndex = 3} onclick={() => void apply()}>
            {#snippet child({ props })}
                <button {...props} class="icon icon-button hoverable activable focusable" data-preset-action="apply">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html checkIcon}
                </button>
            {/snippet}
        </Tooltip>
    {/if}
</div>
<div class="workspace">
    <div class="presets">
        {#each drafts as preset (preset)}
            <button class="preset hoverable activable focusable" class:selected={selected === preset}
                disabled={pending} tabindex={selected === preset ? 0 : -1} onclick={() => select(preset)} onkeydown={event => listKeydown(event, preset)}>
                <NiceLabel
                    value={preset.name}
                    editable={false}
                    onchange={() => {}}
                    scrollMode="ontime"
                    scrollParam={1.5}
                    scrollPause={0.5}
                />
            </button>
        {/each}
    </div>
    <div class="editor">
        {#if selected}
            <div class="name">
                <label for="transcription-preset-name">{i18n.t("transcription.presets.name.label")}</label>
                <input id="transcription-preset-name" class="input-control focusable" class:invalid={!!nameError()} bind:this={nameInput} disabled={pending || !selected.deletable}
                    spellcheck={false} autocomplete="off" value={selected.name} oninput={event => {
                        if (!selected?.deletable) return;
                        selected.name = event.currentTarget.value;
                        void persist();
                    }} />
            </div>
            {#key selected}
                <ConfigFields {dialogId} config={selected.config} onchange={config => {
                    if (!selected?.deletable) return;
                    selected.config = config;
                    void persist();
                }} disabled={pending || !selected.deletable} />
            {/key}
        {:else}
            <div class="empty">{i18n.t("transcription.presets.empty")}</div>
        {/if}
    </div>
</div>
{#if failure}
    <div class="error-message">{i18n.t("transcription.presets.saveError", { error: describeFailure(failure) })}</div>
    <TextButton class="presetsRetry" onclick={() => void settingsAPI.flush()}>{i18n.t("common.retry")}</TextButton>
{/if}


<style>
    .toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .icon {
        box-sizing: border-box;
        width: 32px;
        height: 32px;
        padding: 5px;
        color: var(--c-text);
    }
    .icon:disabled {
        opacity: 0.4;
    }
    .unavailableDelete {
        display: flex;
    }
    .unavailableDelete :global(button) {
        pointer-events: none;
    }
    .divider {
        width: 1px;
        height: 22px;
        margin: 0 6px;
        background: var(--c-border);
    }
    .workspace {
        display: grid;
        flex: 1 0 0;
        grid-template-columns: 200px minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr);
        gap: 20px;
        min-height: 0;
    }
    .presets {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        min-height: 0;
        overflow-y: auto;
        padding: 4px;
        margin: -4px;
    }
    .preset {
        box-sizing: border-box;
        width: 100%;
        padding: 6px 10px;
        text-align: left;
        border-radius: 6px;
        color: var(--c-text);
    }
    .preset.selected {
        --bg: var(--c-selection-bg);
        background: var(--bg);
    }
    .editor {
        display: flex;
        flex-direction: column;
        gap: 18px;
        min-width: 0;
        min-height: 0;
        overflow-y: auto;
        padding: 4px;
        margin: -4px;
    }
    .editor > :global(*) {
        flex-shrink: 0;
    }
    .name {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    label {
        font-weight: 600;
    }
    input {
        width: 100%;
        padding: 8px 10px;
        user-select: text;
    }
    input.invalid {
        border-color: var(--c-danger);
    }
    .empty {
        padding: 32px 0;
    }
    :global(.text-button.presetsRetry) {
        align-self: flex-start;
        padding: 6px 12px;
        font-size: inherit;
    }
    @media (max-width: 620px) {
        .workspace {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: minmax(0, min(130px, 30%)) minmax(0, 1fr);
            gap: 16px;
        }
    }
</style>


<script lang="ts">
    import { focusIndex } from "../../dom";
    import TextButton from "../util/TextButton.svelte";
    import { onMount, tick, untrack } from "svelte";
    import * as i18n from "../../i18n.svelte";
    import * as settings from "../../states/settings.svelte";
    import { defaultConfig, type Config, type Presets } from "../../../shared/transcription/Config";
    import { mergePresets } from "../../../shared/transcription/presets";
    import { VestigeErrors } from "../../../shared/failure";
    import { describeFailure } from "../../failures";
    import ConfigFields from "./ConfigFields.svelte";
    import ConfirmDeleteButton from "../util/ConfirmDeleteButton.svelte";
    import NiceLabel from "../util/NiceLabel.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import newIcon from "../../../resources/icons/carbon--add-large.svg?raw";
    import copyIcon from "../../../resources/icons/carbon--copy.svg?raw";
    import checkIcon from "../../../resources/icons/carbon--checkmark.svg?raw";
    import * as settingsAPI from "../../states/settings";

    type Draft = { name: string; config: Config; deletable: boolean };
    type Props = {
        dialogId: string;
        selectedName?: string;
        onApply?: (name: string, config: Config) => void;
        beforeClose?: () => Promise<boolean>;
    };
    let { dialogId, selectedName, onApply, beforeClose = $bindable() }: Props = $props();
    const initial = await load();
    let drafts = $state<Draft[]>(mergePresets(initial).map(preset => ({ ...preset, config: copyConfig(preset.config) })));
    let selected = $state<Draft | null>(untrack(() => drafts.find(draft => draft.name === selectedName) ?? drafts[0] ?? null));
    let nameInput = $state<HTMLInputElement>();
    let pending = $state(false);
    let toolbarIndex = $state(0);
    const toolbarTabStop = $derived((!selected || (toolbarIndex === 2 && !selected.deletable)) ? 0 : toolbarIndex);
    let updates = Promise.resolve(true);
    let lastSubmitted = JSON.stringify(initial);
    const failure = $derived(settings.getError());
    const operations = $derived([
        { key: "new", index: 0, text: i18n.t("transcription.presets.actions.new"), icon: newIcon, run: () => add(false) },
        { key: "copy", index: 1, text: i18n.t("transcription.presets.actions.copy"), icon: copyIcon, run: () => add(true) }
    ]);

    $effect(() => nameInput?.setCustomValidity(nameError()));
    onMount(() => {
        beforeClose = commit;
        const unsubscribe = settingsAPI.registerDraft({ dialogId, commit });
        return () => {
            beforeClose = undefined;
            unsubscribe();
        };
    });

    async function load(): Promise<Presets> {
        if (await settingsAPI.initialize()) return settings.getConfirmed()!.transcription.presets;
        throw new VestigeErrors(settings.getError() ?? { kind: "unexpected", diagnostic: "Settings initialization was interrupted." });
    }

    function copyConfig(config: Config): Config {
        return { ...config, params: { ...config.params } };
    }

    function nameError(): string {
        if (!selected?.deletable) return "";
        if (!selected.name.trim()) return i18n.t("transcription.presets.name.required");
        const name = selected.name;
        if (drafts.some(draft => draft !== selected && draft.name === name)) return i18n.t("transcription.presets.name.duplicate");
        return "";
    }

    function valid(report = true): boolean {
        const error = nameError();
        if (error && report) {
            nameInput?.setCustomValidity(error);
            nameInput?.focus();
            nameInput?.reportValidity();
        }
        return !error;
    }

    function persist(): Promise<boolean> {
        if (!valid(false)) return Promise.resolve(false);
        const presets = Object.fromEntries(drafts.filter(draft => draft.deletable).map(draft => [draft.name, copyConfig(draft.config)]));
        const builtins = mergePresets(presets).filter(preset => !preset.deletable);
        drafts.filter(draft => !draft.deletable).forEach((draft, index) => draft.name = builtins[index].name);
        const text = JSON.stringify(presets);
        if (text !== lastSubmitted) {
            lastSubmitted = text;
            updates = settingsAPI.update({ transcription: { presets } }).then(success => {
                if (!success && lastSubmitted === text) lastSubmitted = "";
                return success;
            });
        }
        return updates;
    }

    async function commit(): Promise<boolean> {
        return valid() && await persist();
    }

    function uniqueName(base: string): string {
        let name = base;
        for (let suffix = 2; drafts.some(draft => draft.name === name); suffix++) name = `${base} ${suffix}`;
        return name;
    }

    function add(copy: boolean): void {
        if (!valid() || (copy && !selected)) return;
        const name = uniqueName(copy ? i18n.t("transcription.presets.copyName", { name: selected!.name }) : i18n.t("transcription.presets.newName"));
        const index = drafts.filter(preset => preset.deletable).length;
        drafts.splice(index, 0, { name, config: copy && selected ? copyConfig(selected.config) : defaultConfig(), deletable: true });
        selected = drafts[index];
        void persist();
        void tick().then(() => {
            nameInput?.focus(); nameInput?.select();
        });
    }

    function select(preset: Draft): void {
        if (preset !== selected && valid()) selected = preset;
    }

    function remove(): void {
        if (!selected?.deletable || pending) return;
        const index = drafts.indexOf(selected);
        drafts.splice(index, 1);
        selected = drafts[Math.min(index, drafts.length - 1)] ?? null;
        toolbarIndex = 0;
        void persist();
    }

    async function apply(): Promise<void> {
        // Directory selection is validated when transcription starts.
        if (!selected || !valid() || pending) return;
        pending = true;
        try {
            if (await persist()) onApply?.(selected.name, copyConfig(selected.config));
        }
        finally {
            pending = false;
        }
    }

    function toolbarKeydown(event: KeyboardEvent): void {
        const toolbar = event.currentTarget as HTMLElement;
        const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const next = focusIndex(event, buttons.indexOf(event.target as HTMLButtonElement), buttons.length, "horizontal");
        if (next === null) return;
        event.preventDefault();
        buttons[next]?.focus();
    }

    function listKeydown(event: KeyboardEvent, preset: Draft): void {
        const index = focusIndex(event, drafts.indexOf(preset), drafts.length, "vertical", true);
        if (index === null || !valid()) return;
        event.preventDefault();
        selected = drafts[index];
        const target = (event.currentTarget as HTMLElement).parentElement?.children[index];
        void tick().then(() => {
            if (target instanceof HTMLButtonElement) target.focus();
        });
    }
</script>