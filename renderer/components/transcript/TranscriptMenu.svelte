<DropdownMenu.Root {open} onOpenChange={changeOpen}>
    <DropdownMenu.Portal>
        <DropdownMenu.Content class="transcript-menu" data-keyboard={keyboard.current} bind:ref={content} customAnchor={anchor}
            align="start" side="bottom" sideOffset={2} collisionPadding={8} preventScroll={false}
            style={`z-index: ${layerIndex + 1};`} onOpenAutoFocus={focusMenu} onCloseAutoFocus={returnFocus}
            onkeydown={keydown}>
            {#if restoreCommand}
                <DropdownMenu.Item class="activable focusable" onSelect={() => deletionAction(false)}>
                    <div>{i18n.t(request?.target.expanded ? "transcript.information.collapse" : "transcript.information.expand")}</div>
                </DropdownMenu.Item>
                <DropdownMenu.Item class="activable focusable" disabled={project.projectState.locked} onSelect={() => deletionAction(true)}>
                    <div>{commandLabel(restoreCommand)}</div>
                </DropdownMenu.Item>
            {/if}
            {#if references.length}
                <DropdownMenu.Sub onOpenChange={value => referenceFocusPending = value}>
                    <DropdownMenu.SubTrigger class="reference-trigger activable focusable">
                        <div>{i18n.t(request?.target.kind === "gap" ? "transcript.reference.insert" : "transcript.reference.replace")}</div>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html chevronRight}
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.SubContent class="transcript-menu transcript-references" data-keyboard={keyboard.current}
                            align="start" sideOffset={8} collisionPadding={8} style={`z-index: ${layerIndex + 1};`} onkeydown={keydown}
                            onOpenAutoFocus={focusReferences}>
                            {#each references as reference (reference.runId)}
                                {@const display = reference.display}
                                <DropdownMenu.Item class="reference-item activable focusable" disabled={disabled("paste")} onSelect={() => applyReference(reference)}>
                                    {#if display.kind === "comparison"}
                                        <div class="reference-text transcript-preview transcript-comparison" use:fitPreview={{ units: comparisonPreview(display.parts), compact: true }}></div>
                                    {:else}
                                        {@const lines = timing(display.range, display.target)}
                                        <svg class="reference-timing" viewBox="0 0 40 20">
                                            <line class="candidate-time" x1={lines[0]} x2={lines[1]} y1="4" y2="4" />
                                            <line class="target-time" x1={lines[2]} x2={lines[3]} y1="16" y2="16" />
                                        </svg>
                                        <div class="reference-text" use:fitPreview={{ units: previewUnits(display.text.replace(/\r\n?|\n/g, " "), "original"), compact: true }}></div>
                                    {/if}
                                    <span class="reference-run">#{reference.number}</span>
                                </DropdownMenu.Item>
                            {/each}
                        </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                </DropdownMenu.Sub>
            {/if}
            {#if vocabularyMatches.length}
                <DropdownMenu.Sub onOpenChange={value => vocabularyFocusPending = value}>
                    <DropdownMenu.SubTrigger class="reference-trigger activable focusable">
                        <div>{i18n.t("transcription.vocabulary.replace")}</div>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html chevronRight}
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.SubContent class={["transcript-menu transcript-vocabulary", { counted: vocabularyMatches.some(group => group.ranges.length > 1) }]} data-keyboard={keyboard.current}
                            align="start" sideOffset={8} collisionPadding={8} style={"z-index: " + (layerIndex + 1)} onkeydown={keydown}
                            onOpenAutoFocus={event => {
                                if (!vocabularyFocusPending) event.preventDefault();
                                vocabularyFocusPending = false;
                            }}>
                            {#each vocabularyMatches as group (group.rule.id)}
                                <DropdownMenu.Item class="vocabulary-item activable focusable" disabled={disabled("paste")}
                                    onSelect={() => applyVocabulary(group)}>
                                    <div class="vocabulary-source">{group.rule.source}</div>
                                    <span class="vocabulary-arrow" aria-hidden="true">
                                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                        {@html arrowRight}
                                    </span>
                                    <div class="vocabulary-replacement">
                                        {#if group.rule.replacement}{group.rule.replacement}{:else}<i>{i18n.t("transcription.vocabulary.deleteText")}</i>{/if}
                                    </div>
                                    {#if group.ranges.length > 1}<span class="vocabulary-count"><span class="vocabulary-count-text">{i18n.t("transcription.vocabulary.matchCount", { count: group.ranges.length })}</span></span>{/if}
                                </DropdownMenu.Item>
                            {/each}
                        </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                </DropdownMenu.Sub>
            {/if}
            {#if canAddVocabulary}
                <DropdownMenu.Item class="activable focusable" disabled={vocabulary.operation.busy || !!vocabulary.getSnapshot().error} onSelect={addVocabulary}>
                    <div>{i18n.t("transcription.vocabulary.add")}</div>
                </DropdownMenu.Item>
            {/if}
            {#if (references.length || vocabularyMatches.length || canAddVocabulary) && (canAlign || actions.length)}
                <DropdownMenu.Separator class="menu-separator" />
            {/if}
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
        box-shadow:
            0 0 0 1px var(--c-shadow-1),
            0 2px 6px -2px var(--c-shadow-2),
            0 12px 28px -4px var(--c-shadow-3);
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
    .reference-text.transcript-comparison { white-space-collapse: preserve-spaces; }
    .reference-run {
        flex-shrink: 0;
        color: var(--c-text-80p);
        font-size: 12px;
        white-space: nowrap;
    }
    :global(.transcript-vocabulary) {
        display: grid;
        grid-template-columns: minmax(0, max-content) auto minmax(0, max-content);
        column-gap: 24px;
        width: max-content;
        min-width: 0;
    }
    :global(.transcript-vocabulary.counted) {
        grid-template-columns: minmax(0, max-content) auto minmax(0, max-content) auto;
    }
    :global(.transcript-vocabulary .vocabulary-item) {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: subgrid;
        column-gap: 24px;
        align-items: center;
    }
    .vocabulary-source, .vocabulary-arrow, .vocabulary-replacement, .vocabulary-count {
        line-height: 20px;
    }
    .vocabulary-arrow { display: flex; align-items: center; }
    .vocabulary-arrow :global(svg) { width: 16px; height: 16px; }
    .vocabulary-count {
        justify-self: end;
        color: var(--c-text-80p);
        white-space: nowrap;
    }
    .vocabulary-count-text { font-size: 12px; }
    .vocabulary-source, .vocabulary-replacement {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    .vocabulary-source, .vocabulary-arrow { color: var(--c-text-80p); }
    .vocabulary-replacement i { color: var(--c-text-80p); line-height: inherit; }
</style>

<script lang="ts">
    import { onDestroy, tick, untrack } from "svelte";
    import { DropdownMenu, IsUsingKeyboard } from "bits-ui";
    import chevronRight from "../../../resources/icons/lucide--chevron-right.svg?raw";
    import arrowRight from "../../../resources/icons/lucide--arrow-right.svg?raw";
    import { type EditAction } from "../../../shared/app";
    import { transcriptMenuClipboardActions, restoreTranscriptMenuFocus, restoreTranscriptMenuSelection, type TranscriptMenuRequest } from "../../editor/menuTarget";
    import { dismissTranscriptMenu, toggleTranscriptDeletion, canAlignTranscriptSelection, alignTranscriptSelection, transcriptReferenceTarget, applyTranscriptReference } from "../../editor/transcript";
    import { referencePane } from "../../../shared/transcript/reference";
    import { referenceReplacement, type ReferenceReplacement } from "../../editor/referenceReplacement";
    import { type Run } from "../../../shared/transcription/Run";
    import { type Range } from "../../../shared/util/range";
    import { fitPreview, previewUnits, comparisonPreview } from "../../editor/preview";
    import * as settings from "../../states/settings.svelte";
    import { commandDisabled, commandLabel, runCommand, type Command } from "../../states/commands";
    import { editAvailable, runEdit } from "../../edit";
    import { editShortcut } from "../../keybindings";
    import * as project from "../../states/project.svelte";
    import * as modal from "../../states/modal.svelte";
    import * as i18n from "../../i18n.svelte";
    import * as vocabulary from "../../states/vocabulary.svelte";
    import * as dialogs from "../../states/dialogs";
    import { vocabularyLineBreak } from "../../../shared/vocabulary/Vocabulary";
    import { type VocabularyGroup } from "../../../shared/vocabulary/match";
    import { documentText, applyTranscriptVocabulary, registerTranscriptMenuTarget } from "../../editor/transcript";

    let { runs, run, reference = false }: { runs: Run[]; run: Run; reference?: boolean } = $props();
    type ReferenceItem = ReferenceReplacement & { runId: string; number: number };
    let request = $state.raw<TranscriptMenuRequest | null>(null);
    let open = $state(false);
    let focusPending = false;
    let referenceFocusPending = false;
    let vocabularyFocusPending = false;
    let vocabularyRevision = -1;
    let content = $state<HTMLDivElement | null>(null);
    const keyboard = new IsUsingKeyboard();
    const actions = $derived<readonly EditAction[]>(reference ? ["copy", "selectAll"] : request ? transcriptMenuClipboardActions(request.target) : []);
    let selectedSource = $state("");
    const canAddVocabulary = $derived(!!selectedSource && !vocabularyLineBreak.test(selectedSource));
    const canAlign = $derived(!reference && request?.target.kind === "selection" && canAlignTranscriptSelection(request.view, request.selection));
    const references = $derived(!reference && request ? referenceItems(request) : []);
    let vocabularyMatches = $state.raw<VocabularyGroup[]>([]);
    const restoreCommand = $derived(!reference && request?.target.kind === "deletion" && request.target.information
        ? { kind: "restoreTranscriptDeletion", target: request.view.dom, key: request.target.information.key } satisfies Command : null);
    const anchor = $derived(request ? { getBoundingClientRect: () => request!.anchor } : undefined);
    const layer = Symbol();
    const layerIndex = $derived(modal.getLayerIndex(layer));

    export function show(value: TranscriptMenuRequest | null): boolean {
        if (!value) {
            open = false;
            return false;
        }
        if (reference && (value.target.kind === "gap" || value.target.kind === "deletion")) return false;
        if (value.target.kind === "gap" && !referenceItems(value).length) return false;
        if (reference || value.target.kind === "deletion" || value.target.kind === "gap") {
            vocabularyMatches = [];
            selectedSource = "";
        }
        else {
            const text = documentText(value.doc);
            const from = Math.max(0, value.selection.from - 1), to = Math.min(text.length, value.selection.to - 1);
            vocabularyMatches = vocabulary.replacements(text, from, to);
            selectedSource = value.target.kind === "selection" ? text.slice(from, to) : "";
        }
        request = value;
        vocabularyRevision = vocabulary.getSnapshot().revision;
        keyboard.current = value.keyboard;
        focusPending = true;
        open = true;
        return true;
    }

    function changeOpen(value: boolean): void {
        open = value;
        if (!value && request) dismissTranscriptMenu(request.view.dom);
    }

    function applyVocabulary(group: VocabularyGroup): void {
        if (!request || disabled("paste")) return;
        const current = request, revision = vocabularyRevision;
        changeOpen(false);
        void tick().then(() => {
            const snapshot = vocabulary.getSnapshot();
            if (open || request !== current || revision !== snapshot.revision || snapshot.error || disabled("paste") || !vocabularyMatches.includes(group)) return;
            const rule = snapshot.rules.find(rule => rule.id === group.rule.id);
            if (!rule?.enabled || rule.source !== group.rule.source || rule.replacement !== group.rule.replacement || !restoreTranscriptMenuSelection(current)) return;
            applyTranscriptVocabulary(current, group);
        });
    }

    function addVocabulary(): void {
        if (!request || !canAddVocabulary) return;
        const current = request, source = selectedSource;
        changeOpen(false);
        void tick().then(() => {
            if (open || request !== current || !restoreTranscriptMenuSelection(current)) return;
            dialogs.show({ kind: "vocabulary-rule", source });
        });
    }

    function referenceItems(value: TranscriptMenuRequest): ReferenceItem[] {
        const target = transcriptReferenceTarget(value);
        if (!target) return [];
        const editing = settings.getEditing();
        return runs.flatMap((other, i) => {
            if (other.id === run.id) return [];
            const candidate = referenceReplacement(target.source, referencePane(other), target.replacement, editing);
            return candidate ? [{ ...candidate, runId: other.id, number: i + 1 }] : [];
        });
    }

    function timing(candidate: Range, target: Range): number[] {
        const start = Math.min(candidate.start, target.start), end = Math.max(candidate.end, target.end);
        return [candidate.start, candidate.end, target.start, target.end].map(time => Math.round(end === start ? 20 : 1 + (time - start) / (end - start) * 38));
    }

    function applyReference(item: ReferenceItem): void {
        if (!request || disabled("paste")) return;
        const current = request;
        changeOpen(false);
        void tick().then(() => {
            if (open || request !== current || disabled("paste") || !restoreTranscriptMenuSelection(current)) return;
            const other = runs.find(candidate => candidate.id === item.runId && candidate.id !== run.id);
            if (other) applyTranscriptReference(current, other, item.edits, settings.getEditing());
        });
    }

    function disabled(action: EditAction): boolean {
        if (!request || request.view.isDestroyed || request.view.state.doc !== request.doc) return true;
        if (action === "copy" && request.target.previewSelection) return false;
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
        if (!open && request && !request.view.isDestroyed && document.hasFocus()) restoreTranscriptMenuFocus(request.view);
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
    $effect(() => {
        if (!content || !request) return;
        return registerTranscriptMenuTarget(content, request.view);
    });
    $effect(() => {
        const revision = vocabulary.getSnapshot().revision;
        if (open && revision !== vocabularyRevision) untrack(() => changeOpen(false));
    });
    onDestroy(() => {
        if (request) dismissTranscriptMenu(request.view.dom);
        modal.closeLayer(layer);
    });
</script>