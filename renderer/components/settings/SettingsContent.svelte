<div class="titlebarMeasure" bind:clientHeight={titlebarHeight}></div>

<h2 class="section-title">{i18n.t("settings.general.title")}</h2>
{@render fields(generalFields)}

<div class="item">
    <div id="clear-logs-label" class="text">
        <div class="label">{i18n.t("settings.general.clearLogs.label")}</div>
    </div>
    <TextButton id="clear-logs" aria-labelledby="clear-logs-label" disabled={pending || clearingLogs} onclick={() => void clearLogs()}>
        {i18n.t("settings.general.clearLogs.label")}
    </TextButton>
</div>
{#if logsFailure}<div class="error-message">{i18n.t("settings.general.clearLogs.error", { error: logsFailure })}</div>{/if}

<h2 class="section-title">{i18n.t("settings.transcription.title")}</h2>
<div class="transcriptionActions">
    <TextButton disabled={pending} onclick={() => dialogsAPI.show({ kind: "transcription-backends", parentId: dialogId })}>
        {i18n.t("transcription.backends.actions.manage")}
    </TextButton>
    <TextButton disabled={pending} onclick={() => dialogsAPI.show({ kind: "transcription-models", parentId: dialogId })}>
        {i18n.t("transcription.models.actions.manage")}
    </TextButton>
    <TextButton disabled={pending} onclick={() => dialogsAPI.showTranscriptionPresets(dialogId)}>
        {i18n.t("transcription.presets.actions.manage")}
    </TextButton>
</div>
<div class="transcriptionActions">
    <TextButton class="openDirectory" disabled={pending || openingDirectory} onclick={() => void openDirectory("backend")}>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html externalLinkIcon}
        <span>{i18n.t("downloads.backends.actions.openDirectory")}</span>
    </TextButton>
    <TextButton class="openDirectory" disabled={pending || openingDirectory} onclick={() => void openDirectory("model")}>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html externalLinkIcon}
        <span>{i18n.t("downloads.models.actions.openDirectory")}</span>
    </TextButton>
</div>
{#if directoryFailure}<div class="error-message">{directoryFailure}</div>{/if}
{@render fields(transcriptionFields)}

<h2 class="section-title">{i18n.t("settings.editing.title")}</h2>
{@render fields(editingFields)}

<h2 class="section-title">{i18n.t("settings.playback.title")}</h2>
{@render fields(playbackFields)}
<AudioSync bind:value={() => audioOffsetMs, setAudioOffset} bind:input={audioOffsetInput} bind:stopTest={stopCalibration} disabled={pending}
    onchange={value => {
        setAudioOffset(value);
        void applyFields(["audio-offset"]);
    }} />
{@render fields(meterFields)}

<h2 class="section-title">{i18n.t("settings.theme.title")}</h2>
<div class="item">
    <label for={`theme-mode-${themeSettings.mode}`} class="text">
        <div class="label">{i18n.t("settings.theme.mode.label")}</div>
    </label>
    <RadioGroup.Root class="theme-mode-group" orientation="horizontal" disabled={pending}
        bind:value={() => themeSettings.mode, value => {
            if (validThemeMode(value) && value !== themeSettings.mode) {
                themeSettings = { ...themeSettings, mode: value };
                touch("theme-mode");
                void applyFields(["theme-mode"]);
            }
        }}
    >
        {#each themeModes as item (item.mode)}
            <Tooltip id={`theme-mode-${item.mode}`} text={i18n.t(`settings.theme.mode.options.${item.mode}`)} disabled={pending}>
                {#snippet child({ props })}
                    <RadioGroup.Item {...props} value={item.mode} class="themeModeButton hoverable activable focusable">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html item.icon}
                    </RadioGroup.Item>
                {/snippet}
            </Tooltip>
        {/each}
    </RadioGroup.Root>
</div>
{@render fields(themeFields)}
{#each themeSchemes as scheme (scheme)}
    <div class="themeHeading">
        <h3>{i18n.t(`settings.theme.schemes.${scheme}`)}</h3>
        <TextButton class="themeReset" disabled={pending} onclick={() => void resetTheme(scheme)}>
            {i18n.t(`settings.theme.actions.reset`)}
        </TextButton>
    </div>
    {#each themeColorKeys as key (key)}
        {@const color = themeValues[scheme][key]}
        {@const picker = pickers[`${scheme}-${key}`]}
        <div class="item">
            <label for={`theme-${scheme}-${key}`} class="text">
                <div class="label">{i18n.t(`settings.theme.colors.${key}`)}</div>
            </label>
            <div class="themeColorControl">
                <Popover.Root bind:open={picker.open} onOpenChange={open => {
                    if (open) {
                        picker.detached = false;
                        pickerColor = hexToHsla(color)!;
                    }
                }}>
                    <Tooltip id={`theme-${scheme}-${key}`} text={i18n.t("colorPicker.pick")} disabled={pending}
                        ignoreNonKeyboardFocus disableCloseOnTriggerClick={false}>
                        {#snippet child({ props })}
                            <Popover.Trigger {...props} bind:ref={picker.anchor} class="themeSwatch focusable"
                                style={`background-color: ${color};`} disabled={pending} />
                        {/snippet}
                    </Tooltip>
                    <Popover.Portal>
                        <PopoverContent class="themeColorPicker" style={`z-index: ${modal.getTopLayer()};`} align="end" sideOffset={8}
                            onCloseAutoFocus={event => {
                                event.preventDefault();
                                modal.restoreFocus(picker.anchor, { preventScroll: picker.detached });
                            }}
                            collisionPadding={{ top: titlebarHeight + 12, right: 12, bottom: 12, left: 12 }}>
                            <ColorPicker bind:value={pickerColor} alpha={false} disabled={pending} hexLabel={i18n.t("colorPicker.hex")}
                                anchor={picker.anchor} onCloseRequest={() => {
                                    picker.detached = true;
                                    picker.open = false;
                                }}
                                onValueChange={value => editThemeColor(scheme, key, value)}
                                onValueCommit={() => void applyFields([`theme-${scheme}-${key}`])} />
                        </PopoverContent>
                    </Popover.Portal>
                </Popover.Root>
                <div class="themeHex">{color}</div>
            </div>
        </div>
    {/each}
{/each}

<h2 class="section-title">{i18n.t("settings.advanced.title")}</h2>

<h3>{i18n.t("settings.advanced.volumeStabilization.title")}</h3>
{@render fields(advancedFields)}

{#if failure}
    <div class="saveError error-message">{i18n.t("settings.saveError", { error: describeFailure(failure) })}</div>
    <TextButton disabled={pending} onclick={() => void settingsAPI.flush()}>{i18n.t("common.retry")}</TextButton>
{/if}


{#snippet fields(items: Field[])}
    {#each items as field (field.id)}
        {#if field.visible?.() !== false}
            <div class="item" class:selectItem={field.kind === "select"}>
                <label for={field.id} class="text">
                    <div class="label" class:languageLabel={field.language}>
                        {#if field.language}
                            <span>{i18n.t(field.label)}</span>
                            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                            {@html languageIcon}
                        {:else}{i18n.t(field.label)}{/if}
                    </div>
                    {#if field.detail}<div class="description">{field.detail()}</div>{/if}
                    {#if field.kind === "number"}
                        {@const valid = field.valid()}
                        <div class="description" class:error-message={!valid}>
                            <div class:inactive={!valid}>{field.description ? i18n.t(field.description) : ""}</div>
                            <div class:inactive={valid}>{field.invalid()}</div>
                        </div>
                    {:else if field.description}
                        <div class="description">{i18n.t(field.description)}</div>
                    {/if}
                </label>
                {#if field.kind === "switch"}
                    <Switch id={field.id} disabled={pending} bind:checked={field.get, field.set} />
                {:else if field.kind === "select"}
                    <DropdownSelector id={field.id} class="settingsSelect" items={field.items()} disabled={pending} align="end" bind:value={field.get, field.set} />
                {:else}
                    <NumberInput class="settingsNumber" id={field.id} unit={field.unit} min={field.min} max={field.max} step={field.step ?? "any"}
                        bind:ref={inputs[field.id]} bind:value={field.get, field.set} disabled={pending} onblur={() => {
                            if (!pending && field.valid()) void applyFields([field.id]);
                        }} />
                {/if}
            </div>
        {/if}
    {/each}
{/snippet}


<style>
    .item :global(button), .item :global(button *) {
        font-size: 15px;
    }
    h3 {
        margin: 8px 0 0;
    }
    .item {
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        gap: 16px;
    }
    .transcriptionActions {
        display: flex;
        gap: 8px;
    }
    .transcriptionActions :global(.text-button) {
        box-sizing: border-box;
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
    }
    .transcriptionActions :global(.openDirectory) {
        gap: 6px;
    }
    .transcriptionActions :global(.openDirectory span) {
        min-width: 0;
    }
    .text {
        display: flex;
        flex: 1;
        flex-flow: column nowrap;
        gap: 8px;
        min-width: 0;
    }
    .label {
        line-height: 1.6;
        overflow-wrap: anywhere;
    }
    .languageLabel {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .languageLabel :global(svg) {
        flex: none;
        width: 20px;
        height: 20px;
    }
    .item :global(.settingsNumber) {
        flex: 0 0 160px;
        width: 160px;
    }
    .description, .saveError {
        line-height: 1.6;
        overflow-wrap: anywhere;
        font-size: 13px;
    }
    .description {
        display: grid;
        white-space: pre-line;
    }
    .description > div {
        grid-area: 1 / 1;
        line-height: inherit;
    }
    .description > .inactive {
        visibility: hidden;
    }
    .description:not(.error-message) {
        color: var(--c-text-80p);
    }
    .selectItem {
        container-type: inline-size;
        flex-wrap: wrap;
        row-gap: 8px;
    }
    .selectItem :global(.settingsSelect) {
        flex: 0 1 auto;
        width: max-content;
        min-width: 160px;
        max-width: 50%;
    }
    @container (max-width: 480px) {
        .selectItem .text {
            flex-basis: 100%;
        }
        .selectItem :global(.settingsSelect) {
            width: 100%;
            min-width: 0;
            max-width: 100%;
        }
    }
    :global(.theme-mode-group) {
        display: flex;
        flex: 0 0 160px;
        gap: 8px;
    }
    :global(.themeModeButton) {
        --bg: var(--c-background);
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        height: 36px;
        border: 1px solid var(--c-border);
        border-radius: 6px;
        color: var(--c-text);
        background: var(--bg);
    }
    :global(.themeModeButton[data-state="checked"]) {
        --bg: var(--c-surface);
        border-color: var(--c-accent);
        color: var(--c-accent);
    }
    :global(.themeModeButton svg) {
        width: 24px;
        height: 24px;
    }
    .themeHeading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }
    .themeHeading :global(.themeReset) {
        padding: 6px 8px;
        color: var(--c-text);
        font-size: 13px;
    }
    .themeColorControl {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        gap: 12px;
    }
    .themeHex {
        min-width: 7ch;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 14px;
        white-space: nowrap;
        user-select: text;
    }
    :global(.themeSwatch) {
        flex: 0 0 28px;
        height: 28px;
        border: 1px solid var(--c-border);
        border-radius: 6px;
    }
    :global(.themeColorPicker) {
        --color-picker-text: var(--c-text);
        --color-picker-background: var(--c-background);
        --color-picker-border: var(--c-border);
        --color-picker-accent: var(--c-accent);
        --color-picker-error: var(--c-danger);
        width: max-content;
        padding: 16px;
        border: 1px solid var(--c-border);
        border-radius: 8px;
        color: var(--c-text);
        background: var(--c-surface);
        box-shadow: 0 8px 24px var(--c-shadow-3);
    }
    .titlebarMeasure {
        position: fixed;
        width: 0;
        height: env(titlebar-area-height, 0px);
        visibility: hidden;
        pointer-events: none;
    }
</style>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import NumberInput from "../util/NumberInput.svelte";
    import * as i18n from "../../i18n.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as modal from "../../states/modal.svelte";
    import { flushSync, onMount } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import { Popover, RadioGroup } from "bits-ui";
    import DropdownSelector from "../util/DropdownSelector.svelte";
    import AudioSync from "./AudioSync.svelte";
    import Switch from "../util/Switch.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import PopoverContent from "../util/PopoverContent.svelte";
    import ColorPicker from "../util/ColorPicker/index.svelte";
    import { hexToHsla, hslaToHex, type HslaColor } from "../util/ColorPicker/color";
    import { type ParseKeys } from "i18next";
    import { mergeSettings } from "../../../shared/settings/merge";
    import { type Locale } from "../../../shared/locale";
    import { type DownloadKind } from "../../../shared/downloads";
    import { taskCapacity } from "../../../shared/task";
    import { mediaPathModes as mediaPathModeValues } from "../../../shared/project/file";
    import { informationDisplays as informationDisplayValues, volumeSliderMappings as volumeSliderMappingValues, switchPlaybackModes } from "../../../shared/settings/options";
    import { type Settings, type SettingsPatch, type VolumeStabilizationSettings } from "../../../shared/settings/Settings";
    import { validLanguage, validMediaPathMode, validConcurrency, validEditorFontSize, validInformationDisplay, validSidebarTransparency, validVolumeStabilizationValue, validVolumeSliderMapping, validVolumeSliderMinDb, validMediaSwitchPlayback, validWordSwitchPlayback, validLevelMeterReadout, validAudioOffsetMs } from "../../../shared/settings/validate";
    import { defaultSettings } from "../../../shared/settings/defaults";
    import { levelStages } from "../../audio/levels";
    import { minEditorFontSize, maxEditorFontSize, maxVolumeSliderMinDb, volumeStabilizationLimits } from "../../../shared/constants";
    import { VestigeErrors, toFailureInfo } from "../../../shared/failure";
    import { describeFailure } from "../../failures";
    import languageIcon from "../../../resources/icons/carbon--language.svg?raw";
    import externalLinkIcon from "../../../resources/icons/cil--external-link.svg?raw";
    import lightIcon from "../../../resources/icons/carbon--light.svg?raw";
    import contrastIcon from "../../../resources/icons/carbon--contrast.svg?raw";
    import moonIcon from "../../../resources/icons/carbon--moon.svg?raw";
    import {
        themeSchemes, themeColorKeys, resolveTheme, validThemeMode, themeModes as themeModeValues,
        type ThemeColorKey, type ThemeScheme, type ThemeSettings
    } from "../../../shared/theme";
    import * as dialogsAPI from "../../states/dialogs";
    import * as settingsAPI from "../../states/settings";
    import { persistSettings } from "../../states/settingsPersistence";

    let { dialogId, beforeClose = $bindable() }: { dialogId: string; beforeClose?: () => Promise<boolean> } = $props();
    const [current, micaSupported] = await Promise.all([load(), window.api.supportsMica()]);
    let language = $state<Locale>(current.language);
    let compressProjectFiles = $state(current.compressProjectFiles);
    let mediaPathMode = $state(current.mediaPathMode);
    let spellcheck = $state(current.editing.spellcheck);
    let editorFontSize = $state<number | undefined>(current.editing.fontSize);
    let informationDisplay = $state(current.editing.informationDisplay);
    let volumeSliderMapping = $state(current.playback.volumeSliderMapping);
    let volumeSliderMinDb = $state<number | undefined>(current.playback.volumeSliderMinDb);
    let mediaSwitchPlayback = $state(current.playback.mediaSwitchPlayback);
    let wordSwitchPlayback = $state(current.playback.wordSwitchPlayback);
    let rememberPlaybackPosition = $state(current.playback.rememberPlaybackPosition);
    let pauseOnOutputDeviceChange = $state(current.playback.pauseOnOutputDeviceChange);
    let audioOffsetMs = $state<number | undefined>(current.playback.audioOffsetMs);
    let audioOffsetInput = $state<HTMLInputElement>();
    let stopCalibration = $state<() => void>();
    let showLevelMeter = $state(current.playback.showLevelMeter);
    let levelMeterReadout = $state(current.playback.levelMeterReadout);
    let themeSettings = $state<ThemeSettings>(current.theme);
    let sidebarTransparency = $state<number | undefined>(current.theme.sidebarTransparency);
    let themeValues = $state<Record<ThemeScheme, Record<ThemeColorKey, string>>>({
        light: resolveTheme("light", current.theme.light),
        dark: resolveTheme("dark", current.theme.dark)
    });
    let pickerColor = $state<HslaColor>({ h: 0, s: 0, l: 0, a: 1 });
    const pickers = $state<Record<string, { anchor: HTMLButtonElement | null; open: boolean; detached: boolean }>>(
        Object.fromEntries(themeSchemes.flatMap(scheme => themeColorKeys.map(key => [
            `${scheme}-${key}`, { anchor: null, open: false, detached: false }
        ])))
    );
    let titlebarHeight = $state(0);
    const themeModes = themeModeValues.map(mode => ({ mode, icon: { light: lightIcon, system: contrastIcon, dark: moonIcon }[mode] }));
    let concurrency = $state<number | undefined>(current.transcription.concurrency);
    let stabilization = $state<Record<keyof VolumeStabilizationSettings, number | undefined>>({ ...current.volumeStabilization });
    let pending = $state(false);
    let clearingLogs = $state(false);
    let logsFailure = $state("");
    let openingDirectory = $state(false);
    let directoryFailure = $state("");
    const stabilizationFields = ["maxGainDb", "gainAttackMs", "gainReleaseMs", "gateThresholdDb", "targetLevelDb"] as const;
    const stabilizationUnits = {
        maxGainDb: "dB", gainAttackMs: "ms", gainReleaseMs: "ms", gateThresholdDb: "dBFS", targetLevelDb: "dBFS RMS"
    } satisfies Record<keyof VolumeStabilizationSettings, string>;
    let updates = Promise.resolve(true);
    const failure = $derived(settings.getError());
    const languages = $derived(i18n.languageItems());
    const mediaPathModes = $derived(mediaPathModeValues.map(value => ({ value, label: i18n.t(`settings.general.mediaPathMode.options.${value}`) })));
    const informationDisplays = $derived(informationDisplayValues.map(value => ({ value, label: i18n.t(`settings.editing.informationDisplay.options.${value}`) })));
    const volumeSliderMappings = $derived(volumeSliderMappingValues.map(value => ({ value, label: i18n.t(`settings.playback.volumeSliderMapping.options.${value}`) })));
    const switchPlaybackOptions = $derived(switchPlaybackModes.map(value => ({ value, label: i18n.t(`settings.playback.switchPlayback.options.${value}`) })));
    const levelReadouts = $derived(levelStages.map(value => ({ value, label: i18n.t(`settings.playback.levelMeterReadout.options.${value}`) })));

    type FieldMeta = {
        id: string;
        label: ParseKeys;
        description?: ParseKeys;
        detail?: () => string;
        visible?: () => boolean;
        language?: boolean;
    };
    type DraftField = {
        id: string;
        visible?: () => boolean;
        valid: () => boolean;
        patch: (current: Settings) => SettingsPatch;
        focus?: () => void;
    };
    type SwitchField = FieldMeta & DraftField & { kind: "switch"; get: () => boolean; set: (value: boolean) => void };
    type SelectField = FieldMeta & DraftField & {
        kind: "select"; get: () => string; set: (value: string) => void; items: () => { value: string; label: string }[];
    };
    type NumberMeta = FieldMeta & { min?: number; max?: number; step?: string; unit?: string; invalid: () => string };
    type NumberField = NumberMeta & DraftField & {
        kind: "number"; get: () => number | undefined; set: (value: number | undefined) => void;
    };
    type Field = SwitchField | SelectField | NumberField;

    const touched = new SvelteMap<string, number>();
    const inputs = $state<Record<string, HTMLInputElement | undefined>>({});
    let editVersion = 0;
    const generalFields: Field[] = [
        selectField({ id: "interface-language", label: "settings.general.language.label", language: true },
            () => language, value => language = value, validLanguage, value => ({ language: value }), () => languages),
        switchField({ id: "compress-project-files", label: "settings.general.compressProjectFiles.label", description: "settings.general.compressProjectFiles.description" },
            () => compressProjectFiles, value => compressProjectFiles = value, value => ({ compressProjectFiles: value })),
        selectField({ id: "media-path-mode", label: "settings.general.mediaPathMode.label", description: "settings.general.mediaPathMode.description",
            detail: () => i18n.t(`settings.general.mediaPathMode.descriptions.${mediaPathMode}`) },
            () => mediaPathMode, value => mediaPathMode = value, validMediaPathMode, value => ({ mediaPathMode: value }), () => mediaPathModes)
    ];
    const transcriptionFields: Field[] = [
        numberField({ id: "transcription-concurrency", label: "settings.transcription.concurrency.label", description: "settings.transcription.concurrency.description",
            min: 1, max: taskCapacity, step: "1", invalid: () => i18n.t("settings.transcription.concurrency.invalid", { maximum: taskCapacity }) },
            () => concurrency, value => concurrency = value, validConcurrency, value => ({ transcription: { concurrency: value } }))
    ];
    const editingFields: Field[] = [
        switchField({ id: "spellcheck", label: "settings.editing.spellcheck.label", description: "settings.editing.spellcheck.description" },
            () => spellcheck, value => spellcheck = value, value => ({ editing: { spellcheck: value } })),
        numberField({ id: "editor-font-size", label: "settings.editing.fontSize.label", description: "settings.editing.fontSize.description",
            min: minEditorFontSize, max: maxEditorFontSize, unit: "px", invalid: () => i18n.t("settings.validation.number", { min: minEditorFontSize, max: maxEditorFontSize }) },
            () => editorFontSize, value => editorFontSize = value, validEditorFontSize, value => ({ editing: { fontSize: value } })),
        selectField({ id: "editor-information-display", label: "settings.editing.informationDisplay.label", description: "settings.editing.informationDisplay.description" },
            () => informationDisplay, value => informationDisplay = value, validInformationDisplay, value => ({ editing: { informationDisplay: value } }), () => informationDisplays)
    ];
    const playbackFields: Field[] = [
        selectField({ id: "volume-slider-mapping", label: "settings.playback.volumeSliderMapping.label", description: "settings.playback.volumeSliderMapping.description" },
            () => volumeSliderMapping, value => volumeSliderMapping = value, validVolumeSliderMapping, value => ({ playback: { volumeSliderMapping: value } }), () => volumeSliderMappings),
        numberField({ id: "volume-slider-min-db", label: "settings.playback.volumeSliderMinDb.label", description: "settings.playback.volumeSliderMinDb.description",
            max: maxVolumeSliderMinDb, unit: "dB", visible: () => volumeSliderMapping === "decibel",
            invalid: () => i18n.t("settings.playback.volumeSliderMinDb.invalid", { max: maxVolumeSliderMinDb }) },
            () => volumeSliderMinDb, value => volumeSliderMinDb = value, validVolumeSliderMinDb, value => ({ playback: { volumeSliderMinDb: value } })),
        selectField({ id: "media-switch-playback", label: "settings.playback.mediaSwitchPlayback.label" },
            () => mediaSwitchPlayback, value => mediaSwitchPlayback = value, validMediaSwitchPlayback, value => ({ playback: { mediaSwitchPlayback: value } }), () => switchPlaybackOptions),
        selectField({ id: "word-switch-playback", label: "settings.playback.wordSwitchPlayback.label" },
            () => wordSwitchPlayback, value => wordSwitchPlayback = value, validWordSwitchPlayback, value => ({ playback: { wordSwitchPlayback: value } }), () => switchPlaybackOptions),
        switchField({ id: "remember-playback-position", label: "settings.playback.rememberPlaybackPosition.label", description: "settings.playback.rememberPlaybackPosition.description" },
            () => rememberPlaybackPosition, value => rememberPlaybackPosition = value, value => ({ playback: { rememberPlaybackPosition: value } })),
        switchField({ id: "pause-on-output-device-change", label: "settings.playback.pauseOnOutputDeviceChange.label", description: "settings.playback.pauseOnOutputDeviceChange.description" },
            () => pauseOnOutputDeviceChange, value => pauseOnOutputDeviceChange = value, value => ({ playback: { pauseOnOutputDeviceChange: value } }))
    ];
    const meterFields: Field[] = [
        switchField({ id: "show-level-meter", label: "settings.playback.showLevelMeter.label" },
            () => showLevelMeter, value => showLevelMeter = value, value => ({ playback: { showLevelMeter: value } })),
        selectField({ id: "level-meter-readout", label: "settings.playback.levelMeterReadout.label", description: "settings.playback.levelMeterReadout.description", visible: () => showLevelMeter },
            () => levelMeterReadout, value => levelMeterReadout = value, validLevelMeterReadout, value => ({ playback: { levelMeterReadout: value } }), () => levelReadouts)
    ];
    const themeFields: Field[] = [
        switchField({ id: "translucent-sidebar", label: "settings.theme.translucentSidebar.label", description: "settings.theme.translucentSidebar.description", visible: () => micaSupported },
            () => themeSettings.translucentSidebar, value => themeSettings = { ...themeSettings, translucentSidebar: value }, value => ({ theme: { translucentSidebar: value } })),
        numberField({ id: "sidebar-transparency", label: "settings.theme.sidebarTransparency.label", description: "settings.theme.sidebarTransparency.description",
            min: 0, max: 100, unit: "%", visible: () => micaSupported && themeSettings.translucentSidebar,
            invalid: () => i18n.t("settings.validation.number", { min: 0, max: 100 }) },
            () => sidebarTransparency, value => sidebarTransparency = value, validSidebarTransparency, value => ({ theme: { sidebarTransparency: value } }))
    ];
    const advancedFields: Field[] = stabilizationFields.map(key => {
        const limits = volumeStabilizationLimits[key];
        return numberField({ id: `volume-stabilization-${key}`, label: `settings.advanced.volumeStabilization.${key}.label`,
            description: `settings.advanced.volumeStabilization.${key}.description`, ...limits, unit: stabilizationUnits[key],
            invalid: () => i18n.t("settings.validation.number", limits) },
            () => stabilization[key], value => stabilization[key] = value,
            (value): value is number => validVolumeStabilizationValue(key, value), value => ({ volumeStabilization: { [key]: value } }));
    });
    const draftFields: DraftField[] = [
        ...generalFields, ...transcriptionFields, ...editingFields, ...playbackFields,
        { id: "audio-offset", valid: () => validAudioOffsetMs(audioOffsetMs),
            patch: () => validAudioOffsetMs(audioOffsetMs) ? { playback: { audioOffsetMs } } : {}, focus: () => focusInvalidInput(audioOffsetInput) },
        ...meterFields,
        { id: "theme-mode", valid: () => validThemeMode(themeSettings.mode), patch: () => ({ theme: { mode: themeSettings.mode } }) },
        ...themeFields,
        ...themeSchemes.flatMap(scheme => themeColorKeys.map((key): DraftField => ({
            id: `theme-${scheme}-${key}`, valid: () => hexToHsla(themeValues[scheme][key]) !== null,
            patch: current => {
                const overrides = { ...current.theme[scheme] };
                const color = themeValues[scheme][key];
                if (color === defaultSettings.theme[scheme][key]) delete overrides[key];
                else overrides[key] = color;
                return { theme: { [scheme]: overrides } };
            }
        }))),
        ...advancedFields
    ];

    function switchField(meta: FieldMeta, get: () => boolean, set: (value: boolean) => void, patch: (value: boolean) => SettingsPatch): SwitchField {
        return { ...meta, kind: "switch", get, valid: () => true, patch: () => patch(get()), set: value => {
            if (value === get()) return;
            set(value);
            touch(meta.id);
            void applyFields([meta.id]);
        } };
    }

    function selectField<Value extends string>(meta: FieldMeta, get: () => Value, set: (value: Value) => void,
        valid: (value: unknown) => value is Value, patch: (value: Value) => SettingsPatch, items: SelectField["items"]): SelectField {
        return { ...meta, kind: "select", get, items, valid: () => valid(get()), patch: () => patch(get()), set: value => {
            if (!valid(value) || value === get()) return;
            set(value);
            touch(meta.id);
            void applyFields([meta.id]);
        } };
    }

    function numberField(meta: NumberMeta, get: () => number | undefined, set: (value: number | undefined) => void,
        valid: (value: unknown) => value is number, patch: (value: number) => SettingsPatch): NumberField {
        const field: NumberField = { ...meta, kind: "number", get, valid: () => valid(get()), patch: () => {
            const value = get();
            return valid(value) ? patch(value) : {};
        }, focus: () => focusInvalidInput(inputs[meta.id]), set: value => {
            if (Object.is(value, get())) return;
            set(value);
            touch(meta.id);
        } };
        return field;
    }

    onMount(() => {
        beforeClose = close;
        const unsubscribe = settingsAPI.registerDraft({ dialogId, commit });
        return () => {
            beforeClose = undefined;
            unsubscribe();
        };
    });

    async function clearLogs(): Promise<void> {
        if (clearingLogs) return;
        clearingLogs = true;
        logsFailure = "";
        try {
            const result = await window.api.clearLogs();
            if (!result.success) logsFailure = describeFailure(result.error);
        }
        catch (error) {
            logsFailure = describeFailure(toFailureInfo(error));
        }
        finally {
            clearingLogs = false;
        }
    }

    async function openDirectory(kind: DownloadKind): Promise<void> {
        if (openingDirectory) return;
        openingDirectory = true;
        directoryFailure = "";
        try {
            const result = await window.api.downloads.openDirectory(kind);
            if (!result.success) directoryFailure = describeFailure(result.error);
        }
        catch (error) {
            directoryFailure = describeFailure(toFailureInfo(error));
        }
        finally {
            openingDirectory = false;
        }
    }

    async function load(): Promise<Settings> {
        const initialized = await settingsAPI.initialize();
        const current = settings.getConfirmed();
        if (initialized && current) return current;
        const failure = settings.getError();
        if (failure) throw new VestigeErrors(failure);
        throw new Error("Settings initialization was interrupted.");
    }

    function touch(id: string): void {
        touched.set(id, ++editVersion);
    }

    function applyFields(ids: readonly string[]): Promise<boolean> {
        updates = updates.then(async () => {
            // Read current drafts when this queued operation starts, then only clear
            // the versions that were accepted. Later edits remain pending.
            const fields = draftFields.filter(field => ids.includes(field.id) && touched.has(field.id) && field.visible?.() !== false);
            if (fields.some(field => !field.valid())) return false;
            const versions = new Map(fields.map(field => [field.id, touched.get(field.id)]));
            const current = settings.getCurrent();
            let patch: SettingsPatch = {};
            for (const field of fields) patch = mergeSettings(patch, field.patch(mergeSettings(current, patch)));
            if (Object.keys(patch).length && !await settingsAPI.update(patch)) return false;
            for (const [id, version] of versions) if (touched.get(id) === version) touched.delete(id);
            return true;
        });
        return updates;
    }

    function setAudioOffset(value: number | undefined): void {
        if (Object.is(value, audioOffsetMs)) return;
        audioOffsetMs = value;
        touch("audio-offset");
    }

    function editThemeColor(scheme: ThemeScheme, key: ThemeColorKey, value: HslaColor): void {
        const color = hslaToHex(value, false);
        if (color === themeValues[scheme][key]) return;
        themeValues[scheme][key] = color;
        touch(`theme-${scheme}-${key}`);
    }

    function resetTheme(scheme: ThemeScheme): Promise<boolean> {
        themeValues[scheme] = { ...defaultSettings.theme[scheme] };
        const ids = themeColorKeys.map(key => `theme-${scheme}-${key}`);
        for (const id of ids) touch(id);
        return applyFields(ids);
    }

    function focusInvalidInput(input: HTMLInputElement | undefined): void {
        // A rejected close must re-enable the controls before moving focus.
        flushSync(() => pending = false);
        input?.focus({ preventScroll: true });
        input?.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
    }

    async function commit(): Promise<boolean> {
        stopCalibration?.();
        await updates;
        while (true) {
            const fields = draftFields.filter(field => touched.has(field.id) && field.visible?.() !== false);
            const invalid = fields.find(field => !field.valid());
            if (invalid) {
                invalid.focus?.();
                return false;
            }
            if (!fields.length) return true;
            if (!await applyFields(fields.map(field => field.id))) return false;
        }
    }

    async function close(): Promise<boolean> {
        if (pending) return false;
        pending = true;
        try {
            // Quit commits drafts directly and owns its separate D2 confirmation.
            return await persistSettings("close", commit, dialogId);
        }
        finally {
            pending = false;
        }
    }
</script>