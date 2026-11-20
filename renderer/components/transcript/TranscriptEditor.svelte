<div class="editor-shell">
    <div class="editor-surface">
        {#each selectedBreaks as box (box.pos)}
            <div class="selected-break" class:comparison={selectionBounds?.reference} aria-hidden="true" style:left={`${box.left}px`} style:top={`${box.top}px`}
                style:width={`${box.fontSize / 2}px`} style:height={`${box.height}px`}></div>
        {/each}
        <div
            class="editor" spellcheck={false} style:--transcript-font-size={`${fontSize}px`}
            tabindex={-1} bind:this={element}
        >
            <svg
                class="playback-outline" aria-hidden="true" viewBox={outlineViewBox(playbackOutline.box)} style={outlineStyle(playbackOutline.box)}
                style:stroke-width={`${playbackOutline.strokeWidth}px`}
            >
                {#each playbackOutline.paths as path, index (index)}<path d={path} />{/each}
            </svg>
        </div>
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
            <svg class="inspection-outline" viewBox={outlineViewBox(inspectionOutline.box)} style={outlineStyle(inspectionOutline.box)}>
                {#each inspectionOutline.paths as path (path)}<path d={path} />{/each}
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

<TranscriptMenu bind:this={contextMenu} runs={vestige.runs} {run} {reference} />


<style>
    /* Resizing the viewport changes only the editor root's bottom padding. */
    @property --transcript-scroll-padding {
        syntax: "<length>";
        inherits: false;
        initial-value: 0px;
    }

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
    .selected-break.comparison { background-color: var(--c-reference-selection); }
    .selected-break {
        position: absolute;
        z-index: 0;
        background-color: var(--c-selection);
        pointer-events: none;
    }
    /* Sized to their paths: a full-editor box makes every insertion or compositing change repaint the whole editor. */
    .playback-outline, .inspection-outline {
        position: absolute;
        overflow: visible;
        pointer-events: none;
        fill: none;
    }
    .playback-outline {
        /* Later marker anchors share this level and paint above playback. */
        z-index: 1;
        stroke: var(--c-accent);
    }
    .inspection-outline {
        z-index: 2;
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
        transform: translateZ(0);
    }
    /* Keep the underline in the hint's layer; paint containment would snap its fractional text origin. */
    .line-break.added::after {
        content: "\2003";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        box-sizing: content-box;
        padding-bottom: calc(.2em + 1px);
        text-decoration-color: var(--c-text);
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
    .editor :global(::highlight(transcript-reference-selection)) {
        background-color: var(--c-reference-selection);
    }
    .editor :global(.transcript-deletion-original::highlight(transcript-reference-selection)),
    .editor :global(.transcript-deletion-original *::highlight(transcript-reference-selection)),
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
    .line-break.added::after, .editor :global(.transcript-added) {
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
    .editor :global(.transcript-event-shape.current) {
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
        /* A block breaks double-click word selection and Ctrl+Arrow at markers. */
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
    }
    /*
     * Scaled through the path data around the viewBox center (markers.ts draws M0 0H10L5 10Z): a transform transition is
     * composited and promotes every overlapping marker and outline into its own layer.
     */
    .editor :global(.transcript-event-shape > path) {
        d: path("M0 0H10L5 10Z");
        transition: d .12s ease;
    }
    .editor :global(.transcript-event-stroke) {
        fill: none;
        stroke: var(--c-background);
        stroke-width: 2px;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    .editor :global(.transcript-event:hover .transcript-event-shape > path) {
        d: path("M-1.25 -1.25H11.25L5 11.25Z");
    }
    .editor :global(.transcript-event.deletion.pressed .transcript-event-shape > path) {
        d: path("M.25 .25H9.75L5 9.75Z");
    }
    @media (prefers-reduced-motion: reduce) {
        .editor :global(.transcript-event-shape > path) {
            transition: none;
        }
    }
</style>


<script lang="ts">
    import { tick, untrack } from "svelte";
    import { Tooltip } from "bits-ui";
    import TranscriptInformation from "./TranscriptInformation.svelte";
    import TranscriptMenu from "./TranscriptMenu.svelte";
    import { type TranscriptMenuCallbacks } from "../../editor/menuTarget";
    import { type Editor } from "@tiptap/core";
    import { type Vestige } from "../../../shared/Vestige";
    import { type Run } from "../../../shared/transcription/Run";
    import { createTranscriptEditor, setTranscriptPlayback } from "../../editor/transcript";
    import { attachTranscriptPlaybackOutline, emptyOutlineBox, outlineBox, type OutlineBox, type PlaybackOutline } from "../../editor/playbackOutline";
    import { attachTranscriptFind } from "../../editor/find";
    import { attachTranscriptSelection, type PaintedSelectionBounds } from "../../editor/selection";
    import { refreshTranscriptInformation, inspectionKey, type TranscriptInspection } from "../../editor/information";
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

    let { vestige, run, reference = false, editor = $bindable() }: { vestige: Vestige; run: Run; reference?: boolean; editor?: Editor } = $props();
    const labels = $derived({ expand: i18n.t("transcript.information.expand"), collapse: i18n.t("transcript.information.collapse") });
    let element: HTMLDivElement;
    let referenceToMount = $state.raw<Run>();
    let playbackOutline = $state.raw<PlaybackOutline>({ paths: [], strokeWidth: 0, box: emptyOutlineBox });
    let contextMenu: { show: TranscriptMenuCallbacks["open"]; edit: TranscriptMenuCallbacks["edit"] };
    let inspection = $state.raw<TranscriptInspection | null>(null);
    let selectionBounds = $state.raw<PaintedSelectionBounds | null>(null);
    let scheduleSelectedBreaks: (() => void) | undefined;
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
    const inspectionOutline = $derived.by(() => {
        if (!inspection?.rectangles.length || !element) return { paths: [], box: emptyOutlineBox };
        const origin = element.getBoundingClientRect();
        const outlined: { left: number; right: number; top: number; bottom: number }[] = [];
        const paths = inspection.rectangles.flatMap(rectangles => rectangles.map((rect, index) => {
            const left = rect.left - origin.left - 1;
            const right = rect.right - origin.left + 1;
            const top = rect.top - origin.top - 1;
            const bottom = rect.bottom - origin.top + 1;
            outlined.push({ left, right, top, bottom });
            return `M ${left} ${top} H ${right} M ${left} ${bottom} H ${right}`
                + (index === 0 ? ` M ${left} ${top} V ${bottom}` : "")
                + (index === rectangles.length - 1 ? ` M ${right} ${top} V ${bottom}` : "");
        }));
        // Matches the inspection outline's CSS stroke width.
        return { paths, box: outlineBox(outlined, 1) };
    });

    function outlineViewBox(box: OutlineBox): string {
        return `${box.left} ${box.top} ${box.width} ${box.height}`;
    }

    function outlineStyle(box: OutlineBox): string {
        return `left: ${box.left}px; top: ${box.top}px; width: ${box.width}px; height: ${box.height}px`;
    }

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
        if (!value || value.suspended || value.menu || value.pressed || value.tooltipPending || informationDisplay !== "tooltip" || !changed) return;
        if (value.control ? controlDismissed : hoverSession?.dismissed) return;
        if (value.control || value.keyboard || !released && hoverSession?.warm) tooltipOpen = true;
        else openTimer = setTimeout(() => {
            openTimer = undefined;
            tooltipOpen = true;
        }, 700);
    }

    $effect.pre(() => {
        if (!reference) return;
        const next = run;
        const timer = setTimeout(() => referenceToMount = next, 0);
        return () => clearTimeout(timer);
    });

    $effect(() => {
        const current = vestige;
        const displayed = run;
        const duration = current.media.duration;
        const isReference = reference;
        if (isReference && referenceToMount !== displayed) return;
        // Plugins need their real scroll container while mounting. Stage that entire subtree
        // off-document so ProseMirror's native selection reads cannot lay out half-built text.
        const viewport = isReference ? element.closest(".transcript-scroll") : null;
        const anchor = viewport && document.createComment("reference transcript");
        function attach(): void {
            if (anchor?.parentNode && viewport) anchor.replaceWith(viewport);
        }
        if (viewport && anchor) {
            viewport.replaceWith(anchor);
            void tick().then(attach);
        }
        const stopTooltip = registerTranscriptTooltip(element, dismissTooltip);
        window.addEventListener("keydown", inspectionKeydown, true);
        const instance = untrack(() => createTranscriptEditor(element, displayed, isReference ? [] : $state.snapshot(current.modifications), isReference ? undefined : modifications => {
            if (project.getVestige(current.media.id) === current) projectAPI.updateModifications(current.media.id, displayed.id, modifications);
        }, isReference ? () => false : () => !project.projectState.locked, {
            duration, labels, onChange: value => {
                if (inspection?.information !== value?.information)
                    transcript.setInspection(current.media.id, displayed.id, value?.information ?? null);
                inspect(value);
            },
            menu: { open: request => contextMenu.show(request), edit: action => contextMenu.edit(action) },
            onHover: hover,
            onSeek: time => runCommand({ kind: "seekWord", time })
        }, isReference));
        editor = instance;
        const stopFind = isReference ? undefined : untrack(() => attachTranscriptFind(instance));
        instance.on("transaction", ({ transaction }) => {
            if (transaction.docChanged || transaction.selectionSet) notifyEditStateChanged();
        });
        notifyEditStateChanged();
        return () => {
            window.removeEventListener("keydown", inspectionKeydown, true);
            attach();
            stopTooltip();
            stopFind?.();
            instance.destroy();
            editor = undefined;
            notifyEditStateChanged();
            transcript.setInspection(current.media.id, displayed.id, null);
            inspect(null);
            clearTimeout(hoverEndTimer);
            hoverEndTimer = undefined;
            hoverSession = null;
        };
    });

    $effect(() => {
        if (!reference) editor?.setEditable(!project.projectState.locked, false);
        untrack(notifyEditStateChanged);
        const currentLabels = labels;
        if (editor) untrack(() => refreshTranscriptInformation(editor!.view, currentLabels));
    });

    $effect(() => {
        const current = editor;
        if (!current) return;
        return attachTranscriptSelection(current, bounds => {
            selectionBounds = bounds;
            scheduleSelectedBreaks?.();
        });
    });

    $effect(() => {
        const current = editor;
        if (!current) return;
        const stop = attachTranscriptPlaybackOutline(current, element, outline => playbackOutline = outline);
        return () => {
            stop();
            playbackOutline = { paths: [], strokeWidth: 0, box: emptyOutlineBox };
        };
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
            if (selectionBounds || !view.state.selection.empty || pointer && !scrolling) lineBreaks = measureLineBreaks(view);
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
        scheduleSelectedBreaks = schedule;
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
            scheduleSelectedBreaks = undefined;
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