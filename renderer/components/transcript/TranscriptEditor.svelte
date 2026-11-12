<div class="editor-shell">
    <div class="editor-surface">
        {#each selectedBreaks as box (box.pos)}
            <div class="selected-break" aria-hidden="true" style:left={`${box.left}px`} style:top={`${box.top}px`}
                style:width={`${box.fontSize / 2}px`} style:height={`${box.height}px`}></div>
        {/each}
        <div
            class="editor" spellcheck={false} style:--transcript-font-size={`${fontSize}px`}
            tabindex={-1} bind:this={element}
        ></div>
        {#if visibleLineBreaks.length}
            <div class="line-breaks" aria-hidden="true">
                {#each visibleLineBreaks as box (box.pos)}
                    <span
                        class="line-break" class:added={box.added} style:left={`${box.left}px`} style:top={`${box.top}px`}
                        style:height={`${box.height}px`} style:line-height={`${box.height}px`} style:font-size={`${box.fontSize}px`}
                    >&emsp;<svg class="line-break-glyph" viewBox="0 0 16 16"><path d="M13 3v7H3M6 7l-3 3 3 3" /></svg></span>
                {/each}
            </div>
        {/if}
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
                <TranscriptInformation information={inspection.information} duration={vestige.media.duration} hideTrivialInformation={settings.getEditing().hideTrivialInformation} />
            </Tooltip.Content>
        {/if}
    </Tooltip.Portal>
</Tooltip.Root>

<TranscriptMenu bind:this={contextMenu} runs={vestige.runs} {run} />


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
        font-size: var(--transcript-font-size);
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        flex: 1;
    }
    .selected-break {
        position: absolute;
        z-index: 0;
        background-color: var(--c-selection);
        pointer-events: none;
    }
    .inspection-outline {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
        z-index: 2;
        fill: none;
        stroke: var(--c-text-80p);
        stroke-width: 1px;
        stroke-dasharray: 3 2;
    }
    .line-breaks {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
    }
    /* The hint is laid out like the break's own text box, so an added break's underline matches added text. */
    .line-break {
        position: absolute;
        white-space: pre;
        color: var(--c-text-80p);
    }
    /* Every glyph is muted; only the underline, colored like added text's, marks an added break. */
    .line-break.added {
        text-decoration-color: var(--c-text);
        text-decoration-line: underline;
        text-decoration-style: dashed;
        text-underline-offset: .2em;
        text-decoration-skip-ink: none;
        text-decoration-thickness: 1px;
    }
    /* Drawn rather than taken from the font, so its size does not depend on the font's arrow glyph. */
    .line-break-glyph {
        position: absolute;
        inset: 0;
        width: .7em;
        height: .7em;
        margin: auto;
        overflow: visible;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    :global(.tooltip-content.transcript-tooltip) {
        display: block;
        max-width: min(400px, calc(100vw - 16px));
        pointer-events: none;
        background: color-mix(in srgb, var(--c-surface) 75%, transparent);
        transition: none;
        transform: none;
    }
    .editor :global(.tiptap) {
        flex: 1;
        padding: 28px;
        padding-bottom: max(28px, var(--transcript-scroll-padding, 0px));
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
    /* Keep the trailing input anchor available without enlarging the native caret. */
    .editor :global(.transcript-trailing-empty img.ProseMirror-separator:has(+ br.ProseMirror-trailingBreak)) {
        position: absolute;
        margin-top: calc((var(--transcript-line-height) + var(--transcript-line-gap) * 2 - 1lh) / 2);
        line-height: normal;
    }
    .editor :global(.ProseMirror-hideselection) {
        caret-color: transparent;
    }
    .editor :global(.tiptap::selection), .editor :global(.tiptap *::selection) {
        background-color: transparent;
    }
    .editor :global(::highlight(transcript-find)) {
        background: var(--c-find);
    }
    .editor :global(::highlight(transcript-find-current)) {
        background: var(--c-find-current);
    }
    .editor :global(::highlight(transcript-selection)) {
        background-color: var(--c-selection);
    }
    .editor :global(.transcript-deletion-original::highlight(transcript-selection)),
    .editor :global(.transcript-deletion-original *::highlight(transcript-selection)) {
        background-color: transparent;
    }
    .editor :global(.transcript-deletion-original::highlight(transcript-deletion-selection)),
    .editor :global(.transcript-deletion-original *::highlight(transcript-deletion-selection)) {
        background-color: var(--c-selection);
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
        /* Inline anchors with positioned children corrupt Chromium's IME text offsets. */
        position: absolute;
        z-index: 1;
        display: inline;
        font-size: 0;
        line-height: 0;
        user-select: none;
    }
    .editor :global(.transcript-events) {
        /* A block breaks double-click word selection and Ctrl+Arrow at markers; inline markers need frozen token highlights during IME composition. */
        position: relative;
        bottom: .05em;
        left: 0;
        display: inline-block;
        transform: translateX(-50%);
        font-size: var(--transcript-font-size);
        line-height: 0;
        user-select: none;
    }
    .editor :global(.transcript-event) {
        position: relative;
        display: inline-grid;
        vertical-align: top;
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
        cursor: pointer;
    }
    .editor :global(.transcript-deletion-original) {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        padding: 1px 4px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--c-danger) 10%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-danger) 20%, transparent);
        box-decoration-break: clone;
        color: var(--c-danger);
        outline: none;
    }
    .editor :global(.transcript-deletion-original > .transcript-event-anchor:first-child .transcript-events) {
        transform: translateX(50%);
    }
    .editor :global(.transcript-event.expanded .transcript-event-shape > path:not(.transcript-event-stroke)) {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5px;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    .editor :global(.transcript-event:focus-visible) {
        outline-offset: max(3px, .2em);
    }
    .editor :global(.transcript-event-shape) {
        width: .55em;
        height: .45em;
        overflow: visible;
        fill: currentColor;
        transform: scale(1);
        transition: transform .12s ease;
    }
    .editor :global(.transcript-event-stroke) {
        fill: none;
        stroke: var(--c-background);
        stroke-width: 2px;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    .editor :global(.transcript-event:hover .transcript-event-shape) {
        transform: scale(1.25);
    }
    .editor :global(.transcript-event.deletion.pressed .transcript-event-shape) {
        transform: scale(.95);
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
    import TranscriptMenu from "./TranscriptMenu.svelte";
    import { type TranscriptMenuCallbacks } from "../../editor/menuTarget";
    import { type Editor } from "@tiptap/core";
    import { Plugin } from "@tiptap/pm/state";
    import { type Vestige } from "../../../shared/Vestige";
    import { type Run } from "../../../shared/transcription/Run";
    import { createTranscriptEditor, setTranscriptPlayback } from "../../editor/transcript";
    import { attachTranscriptFind } from "../../editor/find";
    import { attachTranscriptSelection } from "../../editor/selection";
    import { refreshTranscriptInformation, inspectionKey, type TranscriptInspection, type InspectionInformation } from "../../editor/information";
    import { measureLineBreaks, measureCaretLineBreak, lineBreakAt, type LineBreakBox } from "../../editor/lineBreaks";
    import { invalidateTranscriptLayout, subscribeTranscriptLayout } from "../../editor/layout";
    import { subscribeTranscriptViewport, transcriptScrollIdleDelay } from "../../editor/viewport";
    import { subscribeTranscriptScroll } from "../../editor/scrollInput";
    import { firstTrue } from "../../../shared/util/search";
    import * as project from "../../states/project.svelte";
    import * as player from "../../states/player.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as transcript from "../../states/transcript.svelte";
    import * as projectAPI from "../../states/project";
    import { runCommand } from "../../states/commands";
    import { notifyEditStateChanged } from "../../edit";
    import { registerTranscriptTooltip } from "../../keybindings";
    import * as i18n from "../../i18n.svelte";

    let { vestige, run, onInspect }: { vestige: Vestige; run: Run; onInspect?: (information: InspectionInformation | null) => void } = $props();
    let element: HTMLDivElement;
    let editor = $state.raw<Editor>();
    let contextMenu: { show: TranscriptMenuCallbacks["open"]; edit: TranscriptMenuCallbacks["edit"] };
    let inspection = $state.raw<TranscriptInspection | null>(null);
    let selectionBounds = $state.raw<{ from: number; to: number } | null>(null);
    let lineBreaks = $state.raw<LineBreakBox[]>([]);
    const firstSelectedBreak = $derived(selectionBounds ? breakIndex(selectionBounds.from) : 0);
    const endSelectedBreak = $derived(selectionBounds ? breakIndex(selectionBounds.to) : 0);
    const selectedBreaks = $derived(lineBreaks.slice(firstSelectedBreak, endSelectedBreak));
    let hoveredBreak = $state(-1);
    let caretBreak = $state.raw<LineBreakBox | null>(null);
    const fontSize = $derived(settings.getEditing().fontSize);
    const visibleLineBreaks = $derived.by(() => {
        const result: LineBreakBox[] = [];
        const hovered = lineBreaks[hoveredBreak], caret = caretBreak;
        if (hovered) result.push(hovered);
        if (caret && caret.pos !== hovered?.pos) result.push(caret);
        return result;
    });
    let tooltipOpen = $state(false);
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let hoverSession: { warm: boolean; dismissed: boolean } | null = null;
    let hoverEndTimer: ReturnType<typeof setTimeout> | undefined;
    let controlDismissed = false;
    let previousDisplay = "";
    const informationDisplay = $derived(settings.getEditing().informationDisplay);
    const anchor = $derived.by(() => {
        const rect = inspection?.anchor;
        return rect ? { getBoundingClientRect: () => rect } : undefined;
    });
    const outlines = $derived.by(() => {
        if (!inspection?.rectangles.length || !element) return [];
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

    function breakIndex(position: number): number {
        return firstTrue(lineBreaks.length, i => lineBreaks[i].pos >= position);
    }

    function endHover(): void {
        if (!hoverSession || hoverEndTimer !== undefined) return;
        hoverEndTimer = setTimeout(() => {
            hoverEndTimer = undefined;
            hoverSession = null;
        }, 300);
    }

    function hover(hovered: boolean | "paused"): void {
        if (hovered === false) return endHover();
        clearTimeout(hoverEndTimer);
        hoverEndTimer = undefined;
        if (hovered === true) hoverSession ??= { warm: false, dismissed: false };
    }

    function closeTooltip(): void {
        clearTimeout(openTimer);
        openTimer = undefined;
        if (tooltipOpen && inspection && !inspection.control && !inspection.keyboard) {
            if (hoverSession) hoverSession.warm = true;
            else {
                hoverSession = { warm: true, dismissed: false };
                endHover();
            }
        }
        tooltipOpen = false;
    }

    function dismissTooltip(): boolean {
        if (!tooltipOpen) return false;
        if (inspection?.control) controlDismissed = true;
        closeTooltip();
        if (!inspection?.control && hoverSession) {
            hoverSession.warm = false;
            if (!inspection?.keyboard) hoverSession.dismissed = true;
        }
        return true;
    }

    function inspectionKeydown(event: KeyboardEvent): void {
        if (event.defaultPrevented) return;
        if (event.key === inspectionKey() && !event.repeat) {
            const dismissed = controlDismissed;
            controlDismissed = false;
            if (dismissed && inspection?.control) inspect(inspection, true);
        }
    }

    function inspect(value: TranscriptInspection | null, force = false): void {
        const released = inspection?.control && !value?.control;
        const informationChanged = inspection?.information !== value?.information;
        const changed = force || informationChanged || inspection?.pressed !== value?.pressed
            || inspection?.keyboard !== value?.keyboard || inspection?.control !== value?.control || inspection?.menu !== value?.menu
            || !!inspection?.suspended !== !!value?.suspended || !!inspection?.tooltipPending !== !!value?.tooltipPending;
        if (changed || !value || value.suspended) closeTooltip();
        if (value?.menu && hoverSession) hoverSession.warm = false;
        inspection = value;
        if (informationChanged) {
            onInspect?.(value?.information ?? null);
            const information = value?.information;
            transcript.setInspection(information?.range ? {
                mediaId: vestige.media.id, runId: run.id, range: information.range, playable: information.playable
            } : null);
        }
        if (!value || value.suspended || value.menu || value.pressed || value.tooltipPending || informationDisplay !== "tooltip" || !changed) return;
        if (value.control ? controlDismissed : hoverSession?.dismissed) return;
        if (value.control || value.keyboard || !released && hoverSession?.warm) tooltipOpen = true;
        else openTimer = setTimeout(() => {
            openTimer = undefined;
            tooltipOpen = true;
        }, 700);
    }

    $effect(() => {
        const current = vestige;
        const displayed = run;
        const duration = current.media.duration;
        const stopTooltip = registerTranscriptTooltip(dismissTooltip);
        window.addEventListener("keydown", inspectionKeydown, true);
        const instance = untrack(() => createTranscriptEditor(element, displayed, $state.snapshot(current.modifications), modifications => {
            if (project.getVestige(current.media.id) === current) projectAPI.updateModifications(current.media.id, displayed.id, modifications);
        }, () => !project.projectState.locked, {
            duration, onChange: inspect,
            menu: { open: request => contextMenu.show(request), edit: action => contextMenu.edit(action) },
            onHover: hover,
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
        const stopFind = untrack(() => attachTranscriptFind(instance));
        instance.on("transaction", ({ transaction }) => {
            if (transaction.docChanged || transaction.selectionSet) notifyEditStateChanged();
        });
        notifyEditStateChanged();
        return () => {
            window.removeEventListener("keydown", inspectionKeydown, true);
            stopTooltip();
            stopFind();
            instance.destroy();
            notifyEditStateChanged();
            inspect(null);
            clearTimeout(hoverEndTimer);
            hoverEndTimer = undefined;
            hoverSession = null;
        };
    });

    $effect(() => {
        editor?.setEditable(!project.projectState.locked, false);
        untrack(notifyEditStateChanged);
        const labels = {
            expand: i18n.t("transcript.information.expand"), collapse: i18n.t("transcript.information.collapse")
        };
        if (editor) untrack(() => refreshTranscriptInformation(editor!.view, labels));
    });

    $effect(() => {
        const current = editor;
        if (!current) return;
        return attachTranscriptSelection(current, bounds => selectionBounds = bounds);
    });

    $effect(() => {
        const current = editor;
        if (!current) return;
        const view = current.view;
        let frame = 0;
        let pointer: { x: number; y: number } | null = null;
        let scrolling = false;
        let scrollTimer: ReturnType<typeof setTimeout> | undefined;
        function refresh(): void {
            frame = 0;
            if (view.isDestroyed) return;
            if (!view.state.selection.empty || pointer && !scrolling) lineBreaks = measureLineBreaks(view);
            else if (lineBreaks.length) lineBreaks = [];
            hoveredBreak = pointer && !scrolling ? lineBreakAt(view, pointer.x, pointer.y) : -1;
            caretBreak = measureCaretLineBreak(view);
        }
        function schedule(): void {
            if (!frame) frame = requestAnimationFrame(refresh);
        }
        function move(event: PointerEvent): void {
            if (event.pointerType === "touch") return leave();
            if (pointer?.x === event.clientX && pointer.y === event.clientY) return;
            pointer = { x: event.clientX, y: event.clientY };
            stopViewport.setNeeded(!scrolling);
            schedule();
        }
        function leave(): void {
            if (!pointer) return;
            pointer = null;
            stopViewport.setNeeded(false);
            schedule();
        }
        function scrolled(user: boolean): void {
            if (!user) return schedule();
            scrolling = true;
            stopViewport.setNeeded(false);
            hoveredBreak = -1;
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                scrolling = false;
                stopViewport.setNeeded(pointer !== null);
                schedule();
            }, transcriptScrollIdleDelay);
            // Only the known caret break needs geometry during scrolling without a selection.
            schedule();
        }
        const unsubscribe = subscribeTranscriptLayout(view, schedule);
        const stopViewport = subscribeTranscriptViewport(view, schedule);
        current.on("selectionUpdate", schedule);
        current.on("focus", schedule);
        current.on("blur", schedule);
        element.addEventListener("pointermove", move);
        element.addEventListener("pointerenter", move);
        element.addEventListener("pointerleave", leave);
        // Scrolling moves text under a resting pointer without a pointer event.
        const stopScroll = subscribeTranscriptScroll(view, scrolled);
        $effect(() => {
            // A short transcript can change font size without resizing the editor.
            void fontSize;
            untrack(() => invalidateTranscriptLayout(view));
        });
        return () => {
            cancelAnimationFrame(frame);
            unsubscribe();
            stopViewport.unsubscribe();
            clearTimeout(scrollTimer);
            current.off("selectionUpdate", schedule);
            current.off("focus", schedule);
            current.off("blur", schedule);
            element.removeEventListener("pointermove", move);
            element.removeEventListener("pointerenter", move);
            element.removeEventListener("pointerleave", leave);
            stopScroll();
            lineBreaks = [];
            hoveredBreak = -1;
            caretBreak = null;
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
        const follow = settings.getEditing().followPlayback;
        if (current) untrack(() => setTranscriptPlayback(current, time, follow));
    });
</script>