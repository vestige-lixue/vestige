<svelte:window onpointerdowncapture={handlePointerdown} />

<Popover.Root bind:open>
    <Tooltip text={i18n.t("transcript.runs.title")} {disabled} {tabindex} {onfocus} onclick={event => event.stopPropagation()}>
        {#snippet child({ props })}
            <Popover.Trigger {...props} bind:ref={trigger} class="runsTrigger icon-button hoverable activable focusable">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html filesIcon}
                {#if runCount > 0}
                    <span class="runCount">{runCount}</span>
                {/if}
            </Popover.Trigger>
        {/snippet}
    </Tooltip>
    <Popover.Portal>
        <PopoverContent bind:ref={content} class="mediaRuns option-surface" customAnchor={anchor} align="start" sideOffset={6} collisionPadding={8}
            style={`z-index: ${layerIndex + 1}; font-size: ${fontSize};`}
            trapFocus={!hasDialog && !menuOpen} interactOutsideBehavior="ignore"
            onOpenAutoFocus={event => {
                event.preventDefault();
                focusRun(vestige?.displayedRunIdx ?? 0, false);
            }}
            onCloseAutoFocus={event => {
                event.preventDefault();
                if (!menuOpen && !pointerDismissed) modal.restoreFocus(trigger);
                pointerDismissed = false;
            }}
            onkeydown={handleKeydown}
        >
            {#each vestige?.runs ?? [] as run, index (run.id)}
                {@const displayed = index === vestige?.displayedRunIdx}
                <Tooltip side="right" sideOffset={24} disabled={disabled || hasDialog} tabindex={0} onclick={() => selectRun(run.id)}>
                    {#snippet text()}
                        <div class="runDetails">
                            <div><b>{i18n.t("transcription.config.executer.label")}</b><span>{run.config.executer}</span></div>
                            <div><b>{i18n.t("transcription.config.backendDirectory.label")}</b><span>{directoryName(run.config.backendDirectory)}</span></div>
                            <div><b>{i18n.t("transcription.config.modelDirectory.label")}</b><span>{directoryName(run.config.modelDirectory)}</span></div>
                        </div>
                    {/snippet}
                    {#snippet child({ props })}
                        <div {...props} class="runRow activable focusable" onpointerover={event => {
                            if (!(event.target instanceof Element) || event.target.closest("button")) return;
                            const previous = event.relatedTarget;
                            if (previous instanceof Element && event.currentTarget.contains(previous) && previous.closest("button")
                                && typeof props.onpointerenter === "function") {
                                // Leaving the nested delete button does not re-enter the row.
                                props.onpointerenter(event);
                            }
                        }}>
                            <NiceLabel class="runLabel" value={`#${index + 1} ${formatStartedAt(run.startedAt)}`}
                                editable={false} onchange={() => {}} scrollMode="ontime" scrollParam={1.5} scrollPause={0.5} />
                            {#if displayed}
                                <span class="option-checkmark">
                                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                    {@html checkmarkIcon}
                                </span>
                            {/if}
                            <ConfirmDeleteButton text={i18n.t(displayed ? "transcript.runs.actions.removeWithEdits" : "transcript.runs.actions.remove")}
                                disabled={disabled || hasDialog} resetKey={displayed} onconfirm={() => removeRun(run.id)} />
                        </div>
                    {/snippet}
                </Tooltip>
            {:else}
                <div class="empty">{i18n.t("transcript.runs.empty")}</div>
            {/each}
        </PopoverContent>
    </Popover.Portal>
</Popover.Root>


<style>
    :global(.runsTrigger) {
        position: relative;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
    }
    :global(.runsTrigger:disabled) {
        opacity: 0.4;
    }
    .runCount {
        position: absolute;
        right: 1px;
        bottom: 0;
        display: grid;
        place-items: center;
        min-width: 13px;
        height: 13px;
        padding: 0 2px;
        border-radius: 4px;
        background: var(--c-border);
        color: var(--c-text);
        box-shadow: 0 0 0 1px var(--bg);
        font-size: 11px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        white-space: nowrap;
        pointer-events: none;
    }
    :global(.mediaRuns) {
        width: var(--bits-popover-anchor-width);
        gap: 4px;
    }
    .runRow {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        border-radius: 4px;
        flex-shrink: 0;
        cursor: pointer;
    }
    .runRow:hover, .runRow:focus-visible, .runRow:has(:global(:focus-visible)) {
        background: var(--c-selection-bg);
    }
    .runRow :global(.runLabel) {
        flex: 1;
        width: auto;
        min-width: 0;
        padding: 4px 0;
    }
    .runDetails {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .runDetails > div {
        display: flex;
        justify-content: space-between;
        gap: 16px;
    }
    .runDetails b {
        flex-shrink: 0;
    }
    .runDetails span {
        min-width: 0;
        text-align: right;
    }
    .empty {
        padding: 8px;
        color: var(--c-text-80p);
    }
</style>


<script lang="ts">
    import { Popover } from "bits-ui";
    import { flushSync, onDestroy, tick, untrack } from "svelte";
    import * as i18n from "../../i18n.svelte";
    import * as project from "../../states/project.svelte";
    import * as dialogs from "../../states/dialogs.svelte";
    import * as modal from "../../states/modal.svelte";
    import * as menu from "../../states/menu.svelte";
    import { runCommand } from "../../states/commands";
    import NiceLabel from "../util/NiceLabel.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import PopoverContent from "../util/PopoverContent.svelte";
    import ConfirmDeleteButton from "../util/ConfirmDeleteButton.svelte";
    import filesIcon from "../../../resources/icons/lucide--files.svg?raw";
    import checkmarkIcon from "../../../resources/icons/carbon--checkmark.svg?raw";
    import * as projectAPI from "../../states/project";

    type Props = {
        mediaId: string;
        anchor: HTMLDivElement | null;
        disabled: boolean;
        tabindex: number;
        onfocus: (event: FocusEvent) => void;
    };

    let { mediaId, anchor, disabled, tabindex, onfocus }: Props = $props();
    const vestige = $derived(project.getVestige(mediaId));
    const runCount = $derived(vestige?.runs.length ?? 0);
    const hasDialog = $derived(dialogs.state.dialogs.length > 0);
    const menuOpen = $derived(menu.get() !== "");
    let open = $state(false);
    let pointerDismissed = false;
    let trigger = $state<HTMLButtonElement | null>(null);
    let content = $state<HTMLDivElement | null>(null);
    let fontSize = $state("inherit");
    const layer = Symbol();
    const layerIndex = $derived(modal.getLayerIndex(layer));

    $effect.pre(() => {
        if (open) untrack(() => modal.openLayer(layer));
        else untrack(() => modal.closeLayer(layer));
    });
    onDestroy(() => modal.closeLayer(layer));

    $effect.pre(() => {
        if (disabled || menuOpen) open = false;
    });

    $effect(() => {
        const element = anchor;
        if (!open || !element) return;
        const syncFontSize = (): void => {
            fontSize = getComputedStyle(element).fontSize;
        };
        syncFontSize();
        const observer = new ResizeObserver(syncFontSize);
        observer.observe(element);
        return () => observer.disconnect();
    });

    function formatStartedAt(value: number): string {
        const date = new Date(value);
        return `${date.getFullYear().toString().padStart(4, "0")}.${date.getMonth() + 1}.${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
    }

    function directoryName(path: string): string {
        const parts = path.split(path.startsWith("/") ? /\// : /[\\/]/).filter(Boolean);
        return parts.at(-1) ?? path;
    }

    function selectRun(runId: string): void {
        if (disabled || hasDialog || !vestige) return;
        runCommand({ kind: "selectMedia", mediaId });
        projectAPI.displayRun(mediaId, vestige.runs.findIndex(run => run.id === runId));
    }

    function focusRun(index: number, showTooltip = true): void {
        const rows = content?.querySelectorAll<HTMLElement>(".runRow");
        const target = rows?.[Math.max(0, Math.min(index, rows.length - 1))] ?? content;
        if (showTooltip) target?.focus();
        else modal.restoreFocus(target);
    }

    async function removeRun(runId: string): Promise<void> {
        if (disabled || hasDialog || !vestige) return;
        const index = vestige.runs.findIndex(run => run.id === runId);
        projectAPI.removeRun(mediaId, runId);
        await tick();
        if (open) focusRun(index);
    }

    function handlePointerdown(event: PointerEvent): void {
        if (!open || !(event.target instanceof Node) || content?.contains(event.target) || trigger?.contains(event.target)) return;
        pointerDismissed = true;
        // Release the focus trap before the pressed control handles the same event.
        flushSync(() => open = false);
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.isComposing || hasDialog || !(event.target instanceof HTMLElement)) return;
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            open = false;
            return;
        }
        if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
        const rows = [...content?.querySelectorAll<HTMLElement>(".runRow") ?? []];
        const index = rows.findIndex(row => row.contains(event.target as Node));
        if (index < 0) return;
        if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("runRow")) {
            event.preventDefault();
            const run = vestige?.runs[index];
            if (run) selectRun(run.id);
        }
        else if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Home" || event.key === "End") {
            event.preventDefault();
            focusRun(event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1
                : (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length);
        }
    }
</script>