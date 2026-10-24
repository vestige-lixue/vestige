<div class="titlebarMeasure" bind:clientHeight={titlebarHeight}></div>

<h2 class="section-title">{i18n.t("settings.general.title")}</h2>
<div class="item selectItem">
    <label for="interface-language" class="text">
        <div class="label languageLabel">
            <span>{i18n.t("settings.general.language.label")}</span>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html languageIcon}
        </div>
    </label>
    <DropdownSelector id="interface-language" class="settingsSelect" items={languages} disabled={pending} align="end" bind:value={() => language, value => {
        if (validLanguage(value) && value !== language) {
            language = value;
            void apply({ language: value });
        }
    }} />
</div>

<div class="item">
    <label for="compress-project-files" class="text">
        <div class="label">{i18n.t("settings.general.compressProjectFiles.label")}</div>
        <div class="description">{i18n.t("settings.general.compressProjectFiles.description")}</div>
    </label>
    <Switch id="compress-project-files" disabled={pending} bind:checked={() => compressProjectFiles, value => {
        if (value !== compressProjectFiles) {
            compressProjectFiles = value;
            void apply({ compressProjectFiles: value });
        }
    }} />
</div>

<div class="item selectItem">
    <label for="media-path-mode" class="text">
        <div class="label">{i18n.t("settings.general.mediaPathMode.label")}</div>
        <div class="description">{i18n.t(`settings.general.mediaPathMode.descriptions.${mediaPathMode}`)}</div>
        <div class="description">{i18n.t("settings.general.mediaPathMode.description")}</div>
    </label>
    <DropdownSelector id="media-path-mode" class="settingsSelect" items={mediaPathModes} disabled={pending} align="end" bind:value={() => mediaPathMode, value => {
        if (validMediaPathMode(value) && value !== mediaPathMode) {
            mediaPathMode = value;
            void apply({ mediaPathMode: value });
        }
    }} />
</div>

<div class="item">
    <label for="clear-logs" class="text">
        <div class="label">{i18n.t("settings.general.clearLogs.label")}</div>
    </label>
    <TextButton id="clear-logs" disabled={pending || clearingLogs} onclick={() => void clearLogs()}>
        {i18n.t("settings.general.clearLogs.label")}
    </TextButton>
</div>
{#if logsFailure}<div class="error-message">{i18n.t("settings.general.clearLogs.error", { error: logsFailure })}</div>{/if}

<h2 class="section-title">{i18n.t("settings.transcription.title")}</h2>
<div class="transcriptionActions">
    <TextButton disabled={pending} onclick={() => dialogsAPI.show({ kind: "transcription-backends", parentId: dialogId, onClosed: () => {} })}>
        {i18n.t("transcription.backends.actions.manage")}
    </TextButton>
    <TextButton disabled={pending} onclick={() => dialogsAPI.show({ kind: "transcription-models", parentId: dialogId, onClosed: () => {} })}>
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
<div class="item">
    <label for="transcription-concurrency" class="text">
        <div class="label">{i18n.t("settings.transcription.concurrency.label")}</div>
        <div class="description" class:error-message={!validConcurrency(concurrency)}>
            <div class:inactive={!validConcurrency(concurrency)}>{i18n.t("settings.transcription.concurrency.description")}</div>
            <div class:inactive={validConcurrency(concurrency)}>{i18n.t("settings.transcription.concurrency.invalid")}</div>
        </div>
    </label>
    <NumberInput class="settingsNumber" id="transcription-concurrency" min="1" max={Number.MAX_SAFE_INTEGER} step="1" bind:ref={concurrencyInput} bind:value={concurrency} disabled={pending} onblur={() => {
        if (!pending && validConcurrency(concurrency)) void apply({ transcription: { concurrency } });
    }} />
</div>

<h2 class="section-title">{i18n.t("settings.editing.title")}</h2>
<div class="item">
    <label for="spellcheck" class="text">
        <div class="label">{i18n.t("settings.editing.spellcheck.label")}</div>
        <div class="description">{i18n.t("settings.editing.spellcheck.description")}</div>
    </label>
    <Switch id="spellcheck" disabled={pending} bind:checked={() => spellcheck, value => {
        if (value !== spellcheck) {
            spellcheck = value;
            void apply({ editing: { spellcheck: value } });
        }
    }} />
</div>

<div class="item">
    <label for="editor-font-size" class="text">
        <div class="label">{i18n.t("settings.editing.fontSize.label")}</div>
        <div class="description" class:error-message={!validEditorFontSize(editorFontSize)}>
            <div class:inactive={!validEditorFontSize(editorFontSize)}>{i18n.t("settings.editing.fontSize.description")}</div>
            <div class:inactive={validEditorFontSize(editorFontSize)}>{i18n.t("settings.validation.number", { min: minEditorFontSize, max: maxEditorFontSize })}</div>
        </div>
    </label>
    <NumberInput class="settingsNumber" id="editor-font-size" unit="px" min={minEditorFontSize} max={maxEditorFontSize} step="any"
        bind:ref={editorFontSizeInput} bind:value={editorFontSize} disabled={pending} onblur={() => {
            if (!pending && validEditorFontSize(editorFontSize)) void apply({ editing: { fontSize: editorFontSize } });
        }} />
</div>

<div class="item selectItem">
    <label for="editor-information-display" class="text">
        <div class="label">{i18n.t("settings.editing.informationDisplay.label")}</div>
        <div class="description">{i18n.t("settings.editing.informationDisplay.description")}</div>
    </label>
    <DropdownSelector id="editor-information-display" class="settingsSelect" items={informationDisplays} disabled={pending} align="end" bind:value={() => informationDisplay, value => {
        if (validInformationDisplay(value) && value !== informationDisplay) {
            informationDisplay = value;
            void apply({ editing: { informationDisplay: value } });
        }
    }} />
</div>

<h2 class="section-title">{i18n.t("settings.playback.title")}</h2>
<div class="item selectItem">
    <label for="volume-slider-mapping" class="text">
        <div class="label">{i18n.t("settings.playback.volumeSliderMapping.label")}</div>
        <div class="description">{i18n.t("settings.playback.volumeSliderMapping.description")}</div>
    </label>
    <DropdownSelector id="volume-slider-mapping" class="settingsSelect" items={volumeSliderMappings} disabled={pending} align="end" bind:value={() => volumeSliderMapping, value => {
        if (validVolumeSliderMapping(value) && value !== volumeSliderMapping) {
            volumeSliderMapping = value;
            void apply({ playback: { volumeSliderMapping: value } });
        }
    }} />
</div>
{#if volumeSliderMapping === "decibel"}
    <div class="item">
        <label for="volume-slider-min-db" class="text">
            <div class="label">{i18n.t("settings.playback.volumeSliderMinDb.label")}</div>
            <div class="description" class:error-message={!validVolumeSliderMinDb(volumeSliderMinDb)}>
                <div class:inactive={!validVolumeSliderMinDb(volumeSliderMinDb)}>{i18n.t("settings.playback.volumeSliderMinDb.description")}</div>
                <div class:inactive={validVolumeSliderMinDb(volumeSliderMinDb)}>{i18n.t("settings.playback.volumeSliderMinDb.invalid", { max: maxVolumeSliderMinDb })}</div>
            </div>
        </label>
        <NumberInput class="settingsNumber" id="volume-slider-min-db" unit="dB" max={maxVolumeSliderMinDb} step="any"
            bind:ref={volumeSliderMinInput} bind:value={volumeSliderMinDb} disabled={pending} onblur={() => {
                if (!pending && validVolumeSliderMinDb(volumeSliderMinDb)) void apply({ playback: { volumeSliderMinDb } });
            }} />
    </div>
{/if}
<div class="item selectItem">
    <label for="media-switch-playback" class="text">
        <div class="label">{i18n.t("settings.playback.mediaSwitchPlayback.label")}</div>
    </label>
    <DropdownSelector id="media-switch-playback" class="settingsSelect" items={switchPlaybackOptions} disabled={pending} align="end" bind:value={() => mediaSwitchPlayback, value => {
        if (validMediaSwitchPlayback(value) && value !== mediaSwitchPlayback) {
            mediaSwitchPlayback = value;
            void apply({ playback: { mediaSwitchPlayback: value } });
        }
    }} />
</div>
<div class="item selectItem">
    <label for="word-switch-playback" class="text">
        <div class="label">{i18n.t("settings.playback.wordSwitchPlayback.label")}</div>
    </label>
    <DropdownSelector id="word-switch-playback" class="settingsSelect" items={switchPlaybackOptions} disabled={pending} align="end" bind:value={() => wordSwitchPlayback, value => {
        if (validWordSwitchPlayback(value) && value !== wordSwitchPlayback) {
            wordSwitchPlayback = value;
            void apply({ playback: { wordSwitchPlayback: value } });
        }
    }} />
</div>
<div class="item">
    <label for="remember-playback-position" class="text">
        <div class="label">{i18n.t("settings.playback.rememberPlaybackPosition.label")}</div>
        <div class="description">{i18n.t("settings.playback.rememberPlaybackPosition.description")}</div>
    </label>
    <Switch id="remember-playback-position" disabled={pending} bind:checked={() => rememberPlaybackPosition, value => {
        if (value !== rememberPlaybackPosition) {
            rememberPlaybackPosition = value;
            void apply({ playback: { rememberPlaybackPosition: value } });
        }
    }} />
</div>
<div class="item">
    <label for="pause-on-output-device-change" class="text">
        <div class="label">{i18n.t("settings.playback.pauseOnOutputDeviceChange.label")}</div>
        <div class="description">{i18n.t("settings.playback.pauseOnOutputDeviceChange.description")}</div>
    </label>
    <Switch id="pause-on-output-device-change" disabled={pending} bind:checked={() => pauseOnOutputDeviceChange, value => {
        if (value !== pauseOnOutputDeviceChange) {
            pauseOnOutputDeviceChange = value;
            void apply({ playback: { pauseOnOutputDeviceChange: value } });
        }
    }} />
</div>
<AudioSync bind:value={audioOffsetMs} bind:input={audioOffsetInput} bind:stopTest={stopCalibration} disabled={pending}
    onchange={value => {
        audioOffsetMs = value;
        void apply({ playback: { audioOffsetMs: value } });
    }} />
<div class="item">
    <label for="show-level-meter" class="text">
        <div class="label">{i18n.t("settings.playback.showLevelMeter.label")}</div>
    </label>
    <Switch id="show-level-meter" disabled={pending} bind:checked={() => showLevelMeter, value => {
        if (value !== showLevelMeter) {
            showLevelMeter = value;
            void apply({ playback: { showLevelMeter: value } });
        }
    }} />
</div>
{#if showLevelMeter}
    <div class="item selectItem">
        <label for="level-meter-readout" class="text">
            <div class="label">{i18n.t("settings.playback.levelMeterReadout.label")}</div>
            <div class="description">{i18n.t("settings.playback.levelMeterReadout.description")}</div>
        </label>
        <DropdownSelector id="level-meter-readout" class="settingsSelect" items={levelReadouts} disabled={pending} align="end" bind:value={() => levelMeterReadout, value => {
            if (validLevelMeterReadout(value) && value !== levelMeterReadout) {
                levelMeterReadout = value;
                void apply({ playback: { levelMeterReadout: value } });
            }
        }} />
    </div>
{/if}

<h2 class="section-title">{i18n.t("settings.theme.title")}</h2>
<div class="item">
    <label for={`theme-mode-${themeSettings.mode}`} class="text">
        <div class="label">{i18n.t("settings.theme.mode.label")}</div>
    </label>
    <RadioGroup.Root class="theme-mode-group" orientation="horizontal" disabled={pending}
        bind:value={() => themeSettings.mode, value => {
            if (validThemeMode(value) && value !== themeSettings.mode) {
                themeSettings = { ...themeSettings, mode: value };
                void apply({ theme: { mode: value } });
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
{#if micaSupported}
    <div class="item">
        <label for="translucent-sidebar" class="text">
            <div class="label">{i18n.t("settings.theme.translucentSidebar.label")}</div>
            <div class="description">{i18n.t("settings.theme.translucentSidebar.description")}</div>
        </label>
        <Switch id="translucent-sidebar" disabled={pending} bind:checked={() => themeSettings.translucentSidebar, value => {
            if (value !== themeSettings.translucentSidebar) {
                themeSettings = { ...themeSettings, translucentSidebar: value };
                void apply({ theme: { translucentSidebar: value } });
            }
        }} />
    </div>
    {#if themeSettings.translucentSidebar}
        <div class="item">
            <label for="sidebar-transparency" class="text">
                <div class="label">{i18n.t("settings.theme.sidebarTransparency.label")}</div>
                <div class="description" class:error-message={!validSidebarTransparency(sidebarTransparency)}>
                    <div class:inactive={!validSidebarTransparency(sidebarTransparency)}>{i18n.t("settings.theme.sidebarTransparency.description")}</div>
                    <div class:inactive={validSidebarTransparency(sidebarTransparency)}>{i18n.t("settings.validation.number", { min: 0, max: 100 })}</div>
                </div>
            </label>
            <NumberInput class="settingsNumber" id="sidebar-transparency" unit="%" min="0" max="100" step="any"
                bind:ref={sidebarTransparencyInput} bind:value={sidebarTransparency} disabled={pending} onblur={() => {
                    if (!pending && validSidebarTransparency(sidebarTransparency)) void apply({ theme: { sidebarTransparency } });
                }} />
        </div>
    {/if}
{/if}
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
            <label class="text">
                <div class="label">{i18n.t(`settings.theme.colors.${key}`)}</div>
            </label>
            <div class="themeColorControl">
                <Popover.Root bind:open={picker.open} onOpenChange={open => {
                    if (open) {
                        picker.detached = false;
                        pickerColor = hexToHsla(color)!;
                    }
                }}>
                    <Tooltip id={`theme-${scheme}-${key}`} text={i18n.t("colorPicker.pick")} disabled={pending}>
                        {#snippet child({ props })}
                            <Popover.Trigger {...props} bind:ref={picker.anchor} class="themeSwatch focusable"
                                style={`background-color: ${color};`} disabled={pending} />
                        {/snippet}
                    </Tooltip>
                    <Popover.Portal>
                        <PopoverContent class="themeColorPicker" style={`z-index: ${modal.getTopLayer()};`} align="end" sideOffset={8}
                            onCloseAutoFocus={event => {
                                if (picker.detached) {
                                    event.preventDefault();
                                    picker.anchor?.focus({ preventScroll: true });
                                }
                            }}
                            collisionPadding={{ top: titlebarHeight + 12, right: 12, bottom: 12, left: 12 }}>
                            <ColorPicker bind:value={pickerColor} alpha={false} disabled={pending} hexLabel={i18n.t("colorPicker.hex")}
                                anchor={picker.anchor} onCloseRequest={() => {
                                    picker.detached = true;
                                    picker.open = false;
                                }}
                                onValueChange={value => themeValues[scheme][key] = hslaToHex(value, false)}
                                onValueCommit={() => void commitThemeColor(scheme, key)} />
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
{#each stabilizationFields as key (key)}
    {@const limits = volumeStabilizationLimits[key]}
    {@const valid = validVolumeStabilizationValue(key, stabilization[key])}
    <div class="item">
        <label for={`volume-stabilization-${key}`} class="text">
            <div class="label">{i18n.t(`settings.advanced.volumeStabilization.${key}.label`)}</div>
            <div class="description" class:error-message={!valid}>
                <div class:inactive={!valid}>{i18n.t(`settings.advanced.volumeStabilization.${key}.description`)}</div>
                <div class:inactive={valid}>{i18n.t("settings.validation.number", limits)}</div>
            </div>
        </label>
        <NumberInput class="settingsNumber" id={`volume-stabilization-${key}`} unit={stabilizationUnits[key]} min={limits.min} max={limits.max} step="any"
            bind:ref={stabilizationInputs[key]} bind:value={stabilization[key]} disabled={pending} onblur={() => {
                const value = stabilization[key];
                if (!pending && validVolumeStabilizationValue(key, value)) void apply({ volumeStabilization: { [key]: value } });
            }} />
    </div>
{/each}

{#if failure}
    <div class="saveError error-message">{i18n.t("settings.saveError", { error: describeFailure(failure) })}</div>
    <TextButton disabled={pending} onclick={() => void settingsAPI.save()}>{i18n.t("common.retry")}</TextButton>
{/if}


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
    import { Popover, RadioGroup } from "bits-ui";
    import DropdownSelector from "../util/DropdownSelector.svelte";
    import AudioSync from "./AudioSync.svelte";
    import Switch from "../util/Switch.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import PopoverContent from "../util/PopoverContent.svelte";
    import ColorPicker from "../util/ColorPicker/index.svelte";
    import { hexToHsla, hslaToHex, type HslaColor } from "../util/ColorPicker/color";
    import { type Locale } from "../../../shared/locale";
    import { type DownloadKind } from "../../../shared/downloads";
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
        themeSchemes, themeColorKeys, resolveTheme, validThemeMode,
        type ThemeColorKey, type ThemeScheme, type ThemeSettings, type ThemeOverrides
    } from "../../../shared/theme";
    import * as dialogsAPI from "../../states/dialogs";
    import * as settingsAPI from "../../states/settings";

    let { dialogId, beforeClose = $bindable() }: { dialogId: string; beforeClose?: () => Promise<boolean> } = $props();
    const [current, micaSupported] = await Promise.all([load(), window.api.supportsMica()]);
    let language = $state<Locale>(current.language);
    let compressProjectFiles = $state(current.compressProjectFiles);
    let mediaPathMode = $state(current.mediaPathMode);
    let spellcheck = $state(current.editing.spellcheck);
    let editorFontSize = $state<number | undefined>(current.editing.fontSize);
    let informationDisplay = $state(current.editing.informationDisplay);
    let editorFontSizeInput = $state<HTMLInputElement>();
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
    let sidebarTransparencyInput = $state<HTMLInputElement>();
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
    const themeModes = [
        { mode: "light", icon: lightIcon },
        { mode: "system", icon: contrastIcon },
        { mode: "dark", icon: moonIcon }
    ] as const;
    let concurrency = $state<number | undefined>(current.transcription.concurrency);
    let stabilization = $state<Record<keyof VolumeStabilizationSettings, number | undefined>>({ ...current.volumeStabilization });
    let pending = $state(false);
    let clearingLogs = $state(false);
    let logsFailure = $state("");
    let openingDirectory = $state(false);
    let directoryFailure = $state("");
    let concurrencyInput = $state<HTMLInputElement>();
    let volumeSliderMinInput = $state<HTMLInputElement>();
    const stabilizationFields = ["maxGainDb", "gainAttackMs", "gainReleaseMs", "gateThresholdDb", "targetLevelDb"] as const;
    const stabilizationUnits = {
        maxGainDb: "dB", gainAttackMs: "ms", gainReleaseMs: "ms", gateThresholdDb: "dBFS", targetLevelDb: "dBFS RMS"
    } satisfies Record<keyof VolumeStabilizationSettings, string>;
    const stabilizationInputs = $state<Partial<Record<keyof VolumeStabilizationSettings, HTMLInputElement>>>({});
    let updates = Promise.resolve(true);
    const failure = $derived(settings.getError());
    const languages = $derived([
        { value: "zh-CN", label: i18n.t("settings.general.language.options.zh-CN") },
        { value: "en", label: i18n.t("settings.general.language.options.en") }
    ]);
    const mediaPathModes = $derived((["absolute", "project", "relative"] as const).map(value => ({ value, label: i18n.t(`settings.general.mediaPathMode.options.${value}`) })));
    const informationDisplays = $derived((["tooltip", "bar"] as const).map(value => ({ value, label: i18n.t(`settings.editing.informationDisplay.options.${value}`) })));
    const volumeSliderMappings = $derived((["amplitude", "decibel"] as const).map(value => ({ value, label: i18n.t(`settings.playback.volumeSliderMapping.options.${value}`) })));
    const switchPlaybackOptions = $derived((["pause", "play", "keep", "invert"] as const).map(value => ({ value, label: i18n.t(`settings.playback.switchPlayback.options.${value}`) })));
    const levelReadouts = $derived(levelStages.map(value => ({ value, label: i18n.t(`settings.playback.levelMeterReadout.options.${value}`) })));

    onMount(() => {
        beforeClose = close;
        const unsubscribe = settingsAPI.beforeSave(commit);
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
            await window.api.clearLogs();
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
            await window.api.downloads.openDirectory(kind);
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
        const current = settings.get();
        if (initialized && current) return current;
        const failure = settings.getError();
        if (failure) throw new VestigeErrors(failure);
        throw new Error("Settings initialization was interrupted.");
    }

    function apply(patch: SettingsPatch): Promise<boolean> {
        updates = updates.then(() => settingsAPI.update(patch, { save: true }));
        return updates;
    }

    function commitThemeColor(scheme: ThemeScheme, key: ThemeColorKey): Promise<boolean> {
        const color = themeValues[scheme][key];
        const overrides = { ...themeSettings[scheme] };
        if (color === defaultSettings.theme[scheme][key]) delete overrides[key];
        else overrides[key] = color;
        if (overrides[key] === themeSettings[scheme][key]) return Promise.resolve(true);
        themeSettings = { ...themeSettings, [scheme]: overrides };
        return apply({ theme: { [scheme]: overrides } });
    }

    function resetTheme(scheme: ThemeScheme): Promise<boolean> {
        themeValues[scheme] = { ...defaultSettings.theme[scheme] };
        themeSettings = { ...themeSettings, [scheme]: {} };
        return apply({ theme: { [scheme]: {} } });
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
        if (!validConcurrency(concurrency)) {
            focusInvalidInput(concurrencyInput);
            return false;
        }
        if (!validEditorFontSize(editorFontSize)) {
            focusInvalidInput(editorFontSizeInput);
            return false;
        }
        if (!validAudioOffsetMs(audioOffsetMs)) {
            focusInvalidInput(audioOffsetInput);
            return false;
        }
        if (volumeSliderMapping === "decibel" && !validVolumeSliderMinDb(volumeSliderMinDb)) {
            focusInvalidInput(volumeSliderMinInput);
            return false;
        }
        if (micaSupported && themeSettings.translucentSidebar && !validSidebarTransparency(sidebarTransparency)) {
            focusInvalidInput(sidebarTransparencyInput);
            return false;
        }
        const palettes: Record<ThemeScheme, ThemeOverrides> = { light: {}, dark: {} };
        for (const scheme of themeSchemes) {
            const colors: Partial<Record<ThemeColorKey, string>> = {};
            for (const key of themeColorKeys) {
                const color = themeValues[scheme][key];
                if (color !== defaultSettings.theme[scheme][key]) colors[key] = color;
            }
            palettes[scheme] = colors;
        }
        const volumeStabilization = {} as Record<keyof VolumeStabilizationSettings, number>;
        for (const key of stabilizationFields) {
            const value = stabilization[key];
            if (!validVolumeStabilizationValue(key, value)) {
                focusInvalidInput(stabilizationInputs[key]);
                return false;
            }
            volumeStabilization[key] = value;
        }
        const current = settings.get();
        const editing: Partial<Settings["editing"]> = {
            ...(spellcheck !== current?.editing.spellcheck ? { spellcheck } : {}),
            ...(editorFontSize !== current?.editing.fontSize ? { fontSize: editorFontSize } : {}),
            ...(informationDisplay !== current?.editing.informationDisplay ? { informationDisplay } : {})
        };
        const playback: Partial<Settings["playback"]> = {
            ...(volumeSliderMapping !== current?.playback.volumeSliderMapping ? { volumeSliderMapping } : {}),
            ...(volumeSliderMapping === "decibel" && validVolumeSliderMinDb(volumeSliderMinDb) && volumeSliderMinDb !== current?.playback.volumeSliderMinDb ? { volumeSliderMinDb } : {}),
            ...(mediaSwitchPlayback !== current?.playback.mediaSwitchPlayback ? { mediaSwitchPlayback } : {}),
            ...(wordSwitchPlayback !== current?.playback.wordSwitchPlayback ? { wordSwitchPlayback } : {}),
            ...(rememberPlaybackPosition !== current?.playback.rememberPlaybackPosition ? { rememberPlaybackPosition } : {}),
            ...(pauseOnOutputDeviceChange !== current?.playback.pauseOnOutputDeviceChange ? { pauseOnOutputDeviceChange } : {}),
            ...(audioOffsetMs !== current?.playback.audioOffsetMs ? { audioOffsetMs } : {}),
            ...(showLevelMeter !== current?.playback.showLevelMeter ? { showLevelMeter } : {}),
            ...(levelMeterReadout !== current?.playback.levelMeterReadout ? { levelMeterReadout } : {})
        };
        const theme: Partial<ThemeSettings> = {
            ...(themeSettings.mode !== current?.theme.mode ? { mode: themeSettings.mode } : {}),
            ...(micaSupported && themeSettings.translucentSidebar !== current?.theme.translucentSidebar ? { translucentSidebar: themeSettings.translucentSidebar } : {}),
            ...(micaSupported && validSidebarTransparency(sidebarTransparency) && sidebarTransparency !== current?.theme.sidebarTransparency ? { sidebarTransparency } : {}),
            ...Object.fromEntries(themeSchemes.filter(scheme =>
                themeColorKeys.some(key => palettes[scheme][key] !== current?.theme[scheme][key])
            ).map(scheme => [scheme, palettes[scheme]]))
        };
        themeSettings = { ...themeSettings, ...palettes };
        const patch: SettingsPatch = {
            ...(language !== current?.language ? { language } : {}),
            ...(compressProjectFiles !== current?.compressProjectFiles ? { compressProjectFiles } : {}),
            ...(mediaPathMode !== current?.mediaPathMode ? { mediaPathMode } : {}),
            ...(Object.keys(playback).length > 0 ? { playback } : {}),
            ...(Object.keys(theme).length > 0 ? { theme } : {}),
            ...(concurrency !== current?.transcription.concurrency ? { transcription: { concurrency } } : {}),
            ...(Object.keys(editing).length > 0 ? { editing } : {}),
            ...(stabilizationFields.some(key => volumeStabilization[key] !== current?.volumeStabilization[key]) ? { volumeStabilization } : {})
        };
        return Object.keys(patch).length === 0 || await apply(patch);
    }

    async function close(): Promise<boolean> {
        if (pending) return false;
        pending = true;
        try {
            return await settingsAPI.save();
        }
        finally {
            pending = false;
        }
    }
</script>