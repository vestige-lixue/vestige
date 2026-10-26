<div class="editor-shell">
    {#if informationDisplay === "bar"}
        <div class="information-bar">
            <div class="information-placeholder"><TranscriptInformation information={null} compact /></div>
            <div class="information-content">
                {#key inspection?.information.key}
                    <TranscriptInformation information={inspection?.information ?? null} compact />
                {/key}
            </div>
        </div>
    {/if}
    <div class="editor-surface">
        {#if selectionRectangles.length}
            <svg class="selection-highlight">
                {#each selectionRectangles as rect, index (index)}<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} />{/each}
            </svg>
        {/if}
        <div
            class="editor" spellcheck={settings.getEditing().spellcheck} style:font-size={`${settings.getEditing().fontSize}px`}
            tabindex={-1} bind:this={element}
        ></div>
        {#if inspection?.rectangles.length}
            <svg class="inspection-outline">
                {#each outlines as path (path)}<path d={path} />{/each}
            </svg>
        {/if}
    </div>
</div>

<Tooltip.Root open={tooltipOpen} onOpenChange={value => {
    if (!value) closeTooltip();
}} disableHoverableContent disableCloseOnTriggerClick>
    <Tooltip.Portal>
        {#if tooltipOpen && inspection && informationDisplay === "tooltip"}
            <Tooltip.Content class="tooltip-content transcript-tooltip" customAnchor={anchor} side="top" sideOffset={7} collisionPadding={8}>
                {#key inspection.information.key}
                    <TranscriptInformation information={inspection.information} />
                {/key}
            </Tooltip.Content>
        {/if}
    </Tooltip.Portal>
</Tooltip.Root>


<style>
    .editor-shell {
        display: flex;
        flex-direction: column;
        min-height: 100%;
    }
    .editor-surface {
        position: relative;
        isolation: isolate;
        display: flex;
        flex-direction: column;
        flex: 1;
    }
    .editor {
        --transcript-line-height: 1.2em;
        --transcript-line-gap: .6em;
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        flex: 1;
    }
    .information-bar {
        position: sticky;
        top: 0;
        z-index: 1;
        flex-shrink: 0;
        pointer-events: none;
    }
    .information-placeholder, .information-content {
        min-height: 16px;
        padding: 10px 28px;
        border-bottom: 1px solid var(--c-border);
        background: color-mix(in srgb, var(--c-surface) 75%, transparent);
    }
    .information-placeholder {
        visibility: hidden;
    }
    .information-content {
        position: absolute;
        inset: 0 0 auto;
    }
    .inspection-outline, .selection-highlight {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
    }
    .selection-highlight {
        z-index: 0;
        fill: var(--c-selection);
    }
    .inspection-outline {
        z-index: 2;
        fill: none;
        stroke: var(--c-text-80p);
        stroke-width: 1px;
        stroke-dasharray: 3 2;
    }
    :global(.tooltip-content.transcript-tooltip) {
        display: block;
        max-width: min(440px, calc(100vw - 16px));
        pointer-events: none;
        transition: none;
        transform: none;
    }
    .editor :global(.tiptap) {
        flex: 1;
        padding: 28px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-variant-ligatures: none;
        font-feature-settings: "liga" 0;
        cursor: text;
    }
    .editor :global(.tiptap), .editor :global(.tiptap *) {
        user-select: text;
        line-height: var(--transcript-line-height);
    }
    .editor :global(.tiptap > div) {
        line-height: calc(var(--transcript-line-height) + var(--transcript-line-gap) * 2);
    }
    .editor :global(img.ProseMirror-separator) {
        display: inline;
        border: none;
        margin: 0;
        width: 0;
        height: 0;
    }
    /* Chromium draws an oversized caret beside separators before hard breaks. */
    .editor :global(img.ProseMirror-separator:has(+ br:not(.ProseMirror-trailingBreak))) {
        display: none;
    }
    .editor :global(.ProseMirror-hideselection) {
        caret-color: transparent;
    }
    .editor :global(.tiptap::selection), .editor :global(.tiptap *::selection) {
        background-color: transparent;
    }
    .editor :global(.transcript-text) {
        display: inline;
        padding-block: var(--transcript-line-gap);
    }
    .editor :global(.transcript-added) {
        text-decoration-line: underline;
        text-decoration-style: dashed;
        text-underline-offset: .2em;
        text-decoration-skip-ink: none;
        text-decoration-thickness: 1px;
    }
    .editor :global(.token-prob-0) {
        color: color-mix(in srgb, var(--c-text) 40%, var(--c-background));
    }
    .editor :global(.token-prob-1) {
        color: color-mix(in srgb, var(--c-text) 55%, var(--c-background));
    }
    .editor :global(.token-prob-2) {
        color: color-mix(in srgb, var(--c-text) 70%, var(--c-background));
    }
    .editor :global(.token-prob-3) {
        color: color-mix(in srgb, var(--c-text) 85%, var(--c-background));
    }
    .editor :global(.token-prob-4) {
        color: var(--c-text);
    }
    .editor :global(.current) {
        position: relative;
        z-index: 0;
        outline: .125em solid var(--c-accent);
        outline-offset: .0625em;
    }
    .editor :global(.transcript-event-anchor) {
        position: relative;
        display: inline-block;
        width: 0;
        height: 0;
        line-height: 0;
        user-select: none;
    }
    .editor :global(.transcript-events) {
        position: absolute;
        bottom: .85em;
        left: 0;
        display: flex;
        transform: translateX(-50%);
        line-height: 0;
        user-select: none;
    }
    .editor :global(.transcript-event) {
        position: relative;
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: .8em;
        height: .8em;
        padding: 0;
        border: 0;
        border-radius: 2px;
        background: transparent;
        color: var(--c-accent);
        font-size: inherit;
        line-height: 0;
        user-select: none;
        cursor: default;
    }
    .editor :global(.tiptap.transcript-seek), .editor :global(.transcript-seek *) {
        cursor: pointer;
    }
    .editor :global(.transcript-event.deletion) {
        color: var(--c-danger);
    }
    .editor :global(.transcript-event:focus-visible) {
        outline-offset: max(3px, .2em);
    }
    .editor :global(.transcript-event-shape) {
        width: .55em;
        height: .45em;
        overflow: visible;
        fill: currentColor;
        transition: transform .12s ease;
    }
    .editor :global(.transcript-event-split) {
        display: none;
        fill: var(--c-accent);
    }
    .editor :global(.transcript-event.deletion.gap .transcript-event-split) {
        display: initial;
    }
    .editor :global(.transcript-event-stroke) {
        fill: none;
        stroke: var(--c-background);
        stroke-width: 2px;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    .editor :global(.transcript-event[data-count]::after) {
        content: attr(data-count);
        position: absolute;
        bottom: calc(100% - .25em);
        left: 50%;
        transform: translateX(-50%);
        width: max-content;
        white-space: nowrap;
        color: var(--c-text-80p);
        font-size: .7em;
        font-variant-numeric: tabular-nums;
        line-height: 1;
    }
    .editor :global(.transcript-event:hover .transcript-event-shape), .editor :global(.transcript-event:focus-visible .transcript-event-shape) {
        transform: scale(1.25);
    }
    @media (prefers-reduced-motion: reduce) {
        .editor :global(.transcript-event-shape) {
            transition: none;
        }
    }
</style>


<script lang="ts">
    import { untrack } from "svelte";
    import { Tooltip } from "bits-ui";
    import TranscriptInformation from "./TranscriptInformation.svelte";
    import { type Editor } from "@tiptap/core";
    import { Plugin, type Transaction } from "@tiptap/pm/state";
    import { type Vestige } from "../../../shared/Vestige";
    import { type Run } from "../../../shared/transcription/Run";
    import { createTranscriptEditor, setTranscriptPlayback } from "../../editor/transcript";
    import { type TranscriptInspection } from "../../editor/information";
    import { textRectangles } from "../../editor/geometry";
    import * as project from "../../states/project.svelte";
    import * as player from "../../states/player.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as transcript from "../../states/transcript.svelte";
    import * as projectAPI from "../../states/project";
    import { runCommand } from "../../states/commands";

    let { vestige, run }: { vestige: Vestige; run: Run } = $props();
    let element: HTMLDivElement;
    let editor = $state.raw<Editor>();
    let inspection = $state.raw<TranscriptInspection | null>(null);
    let selectionRectangles = $state.raw<DOMRect[]>([]);
    let tooltipOpen = $state(false);
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let skipDelayUntil = 0;
    let previousDisplay = "";
    const informationDisplay = $derived(settings.getEditing().informationDisplay);
    const anchor = $derived.by(() => {
        const rect = inspection?.anchor;
        return rect ? { getBoundingClientRect: () => rect } : undefined;
    });
    const outlines = $derived.by(() => {
        if (!inspection || !element) return [];
        const origin = element.getBoundingClientRect();
        return inspection.rectangles.flatMap(rectangles => rectangles.map((rect, index) => {
            const left = rect.left - origin.left - 1;
            const right = rect.right - origin.left + 1;
            const top = rect.top - origin.top - 1;
            const bottom = rect.bottom - origin.top + 1;
            return `M ${left} ${top} H ${right} M ${left} ${bottom} H ${right}`
                + (index === 0 ? ` M ${left} ${top} V ${bottom}` : "")
                + (index === rectangles.length - 1 ? ` M ${right} ${top} V ${bottom}` : "");
        }));
    });

    function closeTooltip(): void {
        clearTimeout(openTimer);
        openTimer = undefined;
        if (tooltipOpen) skipDelayUntil = Date.now() + 300;
        tooltipOpen = false;
    }

    function inspect(value: TranscriptInspection | null, force = false): void {
        const released = inspection?.control && !value?.control;
        const changed = force || inspection?.information !== value?.information || inspection?.pressed !== value?.pressed
            || inspection?.keyboard !== value?.keyboard || inspection?.control !== value?.control;
        if (changed || !value) closeTooltip();
        inspection = value;
        const range = value?.information.range;
        transcript.setInspection(range ? { mediaId: vestige.media.id, runId: run.id, range } : null);
        if (!value || value.pressed || informationDisplay !== "tooltip" || !changed) return;
        if (value.control || value.keyboard || !released && Date.now() < skipDelayUntil) tooltipOpen = true;
        else openTimer = setTimeout(() => {
            openTimer = undefined;
            tooltipOpen = true;
        }, 700);
    }

    $effect(() => {
        const current = vestige;
        const displayed = run;
        const instance = untrack(() => createTranscriptEditor(element, displayed, $state.snapshot(current.modifications), modifications => {
            if (project.getVestige(current.media.id) === current) projectAPI.updateModifications(current.media.id, displayed.id, modifications);
        }, () => !project.projectState.locked, {
            duration: current.media.duration, onChange: inspect,
            onSeek: time => runCommand({ kind: "seekWord", time })
        }));
        instance.registerPlugin(new Plugin({
            props: {
                handleKeyDown(view, event) {
                    if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
                        || view.composing || !view.hasFocus()) return false;
                    event.stopPropagation();
                    element.focus({ preventScroll: true });
                    return true;
                }
            }
        }));
        editor = instance;
        return () => {
            instance.destroy();
            inspect(null);
        };
    });

    $effect(() => {
        editor?.setEditable(!project.projectState.locked, false);
    });

    $effect(() => {
        const current = editor;
        if (!current) return;
        let frame = 0;
        let paragraph: Element | null = null;
        function refresh(): void {
            frame = 0;
            if (current!.isDestroyed) return;
            const next = current!.view.dom.firstElementChild;
            if (next !== paragraph) {
                if (paragraph) observer.unobserve(paragraph);
                paragraph = next;
                if (paragraph) observer.observe(paragraph);
            }
            const selection = document.getSelection();
            if (!selection || selection.isCollapsed || !selection.rangeCount
                || !current!.view.dom.contains(selection.anchorNode) || !current!.view.dom.contains(selection.focusNode)) {
                selectionRectangles = [];
                return;
            }
            const origin = element.getBoundingClientRect();
            selectionRectangles = textRectangles(current!.view.dom, selection.getRangeAt(0), true)
                .map(rect => new DOMRect(rect.left - origin.left, rect.top - origin.top, rect.width, rect.height));
        }
        function schedule(): void {
            if (!frame) frame = requestAnimationFrame(refresh);
        }
        function update({ transaction }: { transaction: Transaction }): void {
            if (transaction.docChanged || transaction.selectionSet) schedule();
        }
        const observer = new ResizeObserver(schedule);
        observer.observe(current.view.dom);
        current.on("transaction", update);
        document.addEventListener("selectionchange", schedule);
        window.addEventListener("scroll", schedule, true);
        schedule();
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            current.off("transaction", update);
            document.removeEventListener("selectionchange", schedule);
            window.removeEventListener("scroll", schedule, true);
            selectionRectangles = [];
        };
    });

    $effect(() => {
        if (informationDisplay === previousDisplay) return;
        previousDisplay = informationDisplay;
        untrack(() => inspect(inspection, true));
    });

    $effect(() => {
        const current = editor;
        const time = player.getCurrentTime();
        if (current) untrack(() => setTranscriptPlayback(current, time));
    });
</script>