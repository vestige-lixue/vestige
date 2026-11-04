<DropdownMenu.Root {open} onOpenChange={changeOpen}>
    <DropdownMenu.Portal>
        <DropdownMenu.Content class={["transcript-menu", { "reference-preview": referencePreview }]} data-keyboard={keyboard.current} bind:ref={content} customAnchor={anchor}
            align="start" side="bottom" sideOffset={2} collisionPadding={8} preventScroll={false}
            style={`z-index: ${layerIndex + 1};`} onOpenAutoFocus={focusMenu} onCloseAutoFocus={returnFocus}
            onkeydown={keydown}>
            {#if restoreCommand}
                <DropdownMenu.Item class="activable focusable" disabled={project.projectState.locked} onSelect={() => deletionAction(true)}>
                    <div>{commandLabel(restoreCommand)}</div>
                </DropdownMenu.Item>
                <DropdownMenu.Item class="activable focusable" onSelect={() => deletionAction(false)}>
                    <div>{i18n.t(request?.target.expanded ? "transcript.information.collapse" : "transcript.information.expand")}</div>
                </DropdownMenu.Item>
            {/if}
            {#if references.length}
                <DropdownMenu.Sub onOpenChange={referenceOpenChange}>
                    <DropdownMenu.SubTrigger class="reference-trigger activable focusable"
                        onpointerenter={() => referenceHover = "trigger"} onpointerleave={() => referenceHover = null}>
                        <div>{i18n.t(request?.target.kind === "gap" ? "transcript.reference.insert" : "transcript.reference.replace")}</div>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html chevronRight}
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.SubContent class={["transcript-menu transcript-references", { "reference-preview": referencePreview }]} data-keyboard={keyboard.current}
                            align="start" sideOffset={8} collisionPadding={8} style={`z-index: ${layerIndex + 1};`} onkeydown={keydown}
                            onOpenAutoFocus={focusReferences}
                            onpointerenter={() => referenceHover = "content"} onpointerleave={() => referenceHover = null}>
                            {#each references as reference (reference.text)}
                                {@const lines = timing(reference.range, reference.target)}
                                <DropdownMenu.Item class="reference-item activable focusable" disabled={disabled("paste")} onSelect={() => applyReference(reference.text)}>
                                    <svg class="reference-timing" viewBox="0 0 40 20">
                                        <line class="candidate-time" x1={lines[0]} x2={lines[1]} y1="4" y2="4" />
                                        <line class="target-time" x1={lines[2]} x2={lines[3]} y1="16" y2="16" />
                                    </svg>
                                    <div class="reference-text" use:fitPreview={{ units: previewUnits(reference.text.replace(/\r\n?|\n/g, " "), "original"), compact: true }}></div>
                                    <span class="reference-runs">{reference.runs.map(number => `#${number}`).join(" ")}</span>
                                </DropdownMenu.Item>
                            {/each}
                        </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                </DropdownMenu.Sub>
            {/if}
            {#if references.length && (canAlign || actions.length)}<DropdownMenu.Separator class="menu-separator" />{/if}
            {#if canAlign}
                <DropdownMenu.Item class="activable focusable" disabled={disabled("cut")} onSelect={align}>
                    <div>{i18n.t("transcript.information.align")}</div>
                </DropdownMenu.Item>
                <DropdownMenu.Separator class="menu-separator" />
            {/if}
            {#each actions as action (action)}
                <DropdownMenu.Item class="activable focusable" disabled={disabled(action)} onSelect={() => edit(action)}>
                    <div>{i18n.t(`menu.edit.${action}`)}</div>
                    <kbd>{editShortcut(action)}</kbd>
                </DropdownMenu.Item>
            {/each}
        </DropdownMenu.Content>
    </DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
    :global(.transcript-menu) {
        --bg: var(--c-surface);
        display: flex;
        flex-flow: column nowrap;
        min-width: 190px;
        max-width: min(400px, calc(100vw - 16px));
        max-height: var(--bits-dropdown-menu-content-available-height, calc(100vh - 16px));
        overflow-y: auto;
        padding: 4px;
        border-radius: 8px;
        background: var(--bg);
        transition: opacity .12s;
        box-shadow:
            0 0 0 1px var(--c-shadow-1),
            0 2px 6px -2px var(--c-shadow-2),
            0 12px 28px -4px var(--c-shadow-3);
    }
    :global(.transcript-menu.reference-preview) {
        opacity: .5;
    }
    :global(.transcript-menu [role="menuitem"]) {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
    }
    :global(.transcript-menu [role="menuitem"] > div) {
        min-width: 0;
        overflow-wrap: anywhere;
    }
    :global(.transcript-menu [data-highlighted]:not([data-disabled])) {
        --interaction-opacity: var(--hover-opacity);
    }
    :global(.transcript-menu [data-disabled]) {
        cursor: default;
        opacity: .5;
        pointer-events: none;
    }
    :global(.transcript-menu[data-keyboard="false"] .focusable:focus-visible) {
        outline: none;
    }
    :global(.transcript-menu .menu-separator) {
        height: 1px;
        margin: 4px;
        background: var(--c-border);
    }
    :global(.transcript-references) {
        max-height: var(--bits-menu-content-available-height, calc(100vh - 16px));
    }
    :global(.transcript-menu .reference-item) {
        gap: 12px;
    }
    :global(.transcript-menu .reference-item[data-disabled]) {
        pointer-events: auto;
    }
    :global(.reference-trigger svg) {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
    }
    .reference-timing {
        flex: 0 0 40px;
        width: 40px;
        height: 20px;
        overflow: visible;
        stroke-width: 2px;
        stroke-linecap: square;
    }
    .candidate-time { stroke: var(--c-accent); }
    .target-time { stroke: var(--c-text-80p); }
    .reference-text {
        flex: 1;
        overflow: hidden;
        white-space: pre;
        line-height: 20px;
    }
    .reference-runs {
        flex-shrink: 0;
        color: var(--c-text-80p);
        font-size: 12px;
        white-space: nowrap;
    }
</style>

<script lang="ts">
    import { onDestroy, tick, untrack } from "svelte";
    import { DropdownMenu, IsUsingKeyboard } from "bits-ui";
    import chevronRight from "../../../resources/icons/carbon--chevron-right.svg?raw";
    import { type EditAction } from "../../../shared/app";
    import { transcriptMenuClipboardActions, restoreTranscriptMenuSelection, type TranscriptMenuRequest } from "../../editor/menuTarget";
    import { dismissTranscriptMenu, toggleTranscriptDeletion, canAlignTranscriptSelection, alignTranscriptSelection, transcriptReferenceTarget, applyTranscriptReference } from "../../editor/transcript";
    import { referenceCandidate } from "../../../shared/transcript/reference";
    import { type Run } from "../../../shared/transcription/Run";
    import { type Range } from "../../../shared/util/range";
    import { fitPreview, previewUnits } from "../../editor/preview";
    import * as settings from "../../states/settings.svelte";
    import { commandDisabled, commandLabel, runCommand, type Command } from "../../states/commands";
    import { editAvailable, runEdit } from "../../edit";
    import { editShortcut } from "../../keybindings";
    import * as project from "../../states/project.svelte";
    import * as modal from "../../states/modal.svelte";
    import * as i18n from "../../i18n.svelte";

    let { runs, run }: { runs: Run[]; run: Run } = $props();
    type ReferenceItem = { text: string; range: Range; target: Range; runs: number[] };
    let request = $state.raw<TranscriptMenuRequest | null>(null);
    let open = $state(false);
    let focusPending = false;
    let referenceFocusPending = false;
    let referenceHover = $state<"trigger" | "content" | null>(null);
    const referencePreview = $derived(open && request?.target.kind === "selection" && referenceHover !== null);
    let content = $state<HTMLDivElement | null>(null);
    const keyboard = new IsUsingKeyboard();
    const actions = $derived(request ? transcriptMenuClipboardActions(request.target) : []);
    const canAlign = $derived(request?.target.kind === "selection" && canAlignTranscriptSelection(request.view, request.selection));
    const references = $derived(request ? referenceItems(request) : []);
    const restoreCommand = $derived(request?.target.kind === "deletion" && request.target.information
        ? { kind: "restoreTranscriptDeletion", target: request.view.dom, key: request.target.information.key } satisfies Command : null);
    const anchor = $derived(request ? { getBoundingClientRect: () => request!.anchor } : undefined);
    const layer = Symbol();
    const layerIndex = $derived(modal.getLayerIndex(layer));

    export function show(value: TranscriptMenuRequest | null): boolean {
        referenceHover = null;
        if (!value) {
            open = false;
            return false;
        }
        if (value.target.kind !== "deletion" && !transcriptMenuClipboardActions(value.target).length && !referenceItems(value).length) return false;
        request = value;
        keyboard.current = value.keyboard;
        focusPending = true;
        open = true;
        return true;
    }

    function changeOpen(value: boolean): void {
        open = value;
        if (!value) referenceHover = null;
        if (!value && request) dismissTranscriptMenu(request.view.dom);
    }

    function referenceOpenChange(value: boolean): void {
        referenceFocusPending = value;
        if (!value && referenceHover === "content") referenceHover = null;
    }

    function referenceItems(value: TranscriptMenuRequest): ReferenceItem[] {
        const target = transcriptReferenceTarget(value);
        if (!target) return [];
        const text = target.replacement?.parts.map(part => part.text).join("");
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local grouping is rebuilt for each derived value.
        const grouped = new Map<string, ReferenceItem>();
        runs.forEach((source, i) => {
            if (source.id === run.id) return;
            const candidate = referenceCandidate(source, target.range, settings.getEditing().referenceOverlap);
            if (!candidate || candidate.text === text) return;
            const previous = grouped.get(candidate.text);
            if (previous) {
                previous.runs.push(i + 1);
                previous.range.start = Math.min(previous.range.start, candidate.range.start);
                previous.range.end = Math.max(previous.range.end, candidate.range.end);
            }
            else grouped.set(candidate.text, { text: candidate.text, range: { ...candidate.range }, target: target.range, runs: [i + 1] });
        });
        return [...grouped.values()];
    }

    function timing(candidate: Range, target: Range): number[] {
        const start = Math.min(candidate.start, target.start), end = Math.max(candidate.end, target.end);
        return [candidate.start, candidate.end, target.start, target.end].map(time => Math.round(end === start ? 20 : 1 + (time - start) / (end - start) * 38));
    }

    function applyReference(text: string): void {
        if (!request || disabled("paste")) return;
        const current = request;
        changeOpen(false);
        void tick().then(() => {
            if (open || request !== current || disabled("paste") || !referenceItems(current).some(item => item.text === text)
                || !restoreTranscriptMenuSelection(current)) return;
            applyTranscriptReference(current, text);
        });
    }

    function disabled(action: EditAction): boolean {
        if (!request || request.view.isDestroyed || request.view.state.doc !== request.doc) return true;
        if (action !== "copy" && action !== "selectAll" && (project.projectState.locked || !request.view.editable)) return true;
        if (action === "copy" || action === "cut") return request.selection.empty
            || !request.doc.textBetween(request.selection.from, request.selection.to, "\n", "\n");
        return false;
    }

    export function edit(action: EditAction): void {
        if (!request || disabled(action)) return;
        const current = request;
        changeOpen(false);
        // Release the menu's focus scope before native clipboard commands focus the editor.
        void tick().then(() => {
            if (open || request !== current || disabled(action) || !restoreTranscriptMenuSelection(current) || !editAvailable(current.view.dom, action)) return;
            runEdit(current.view.dom, action);
        });
    }

    function deletionAction(restore: boolean): void {
        if (!request || !restoreCommand || restore && commandDisabled(restoreCommand)) return;
        const current = request, command = restoreCommand;
        changeOpen(false);
        void tick().then(() => {
            if (open || request !== current || !restoreTranscriptMenuSelection(current)) return;
            if (restore) runCommand(command);
            else toggleTranscriptDeletion(current.view.dom, command.key);
        });
    }

    function align(): void {
        if (!request || !canAlign || disabled("cut")) return;
        const current = request;
        changeOpen(false);
        void tick().then(() => {
            if (open || request !== current || disabled("cut") || !restoreTranscriptMenuSelection(current)) return;
            alignTranscriptSelection(current.view);
        });
    }

    function focusMenu(event: Event): void {
        event.preventDefault();
        // Style updates can remount the focus scope; only focus when opening the menu.
        if (!focusPending) return;
        const target = keyboard.current ? content?.querySelector<HTMLElement>("[role=\"menuitem\"]:not([data-disabled])") ?? content : content;
        if (!target) return;
        focusPending = false;
        target.focus({ preventScroll: true });
    }

    function focusReferences(event: Event): void {
        if (!referenceFocusPending) event.preventDefault();
        referenceFocusPending = false;
    }

    function returnFocus(event: Event): void {
        event.preventDefault();
        if (!open && request && !request.view.isDestroyed && document.hasFocus()) request.view.focus();
    }

    function keydown(event: KeyboardEvent): void {
        if (event.defaultPrevented) return;
        if (event.key === "Tab") {
            event.preventDefault();
            changeOpen(false);
            return;
        }
        const mod = window.api.platform === "darwin" ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
        const action = mod && !event.altKey && !event.shiftKey ? ({ x: "cut", c: "copy", v: "paste" } as const)[event.key.toLowerCase()] : undefined;
        if (action) {
            event.preventDefault();
            edit(action);
        }
    }

    $effect.pre(() => {
        if (open) untrack(() => modal.openLayer(layer));
        else untrack(() => modal.closeLayer(layer));
    });
    onDestroy(() => {
        if (request) dismissTranscriptMenu(request.view.dom);
        modal.closeLayer(layer);
    });
</script>