<DropdownMenu.Root {open} onOpenChange={changeOpen}>
    <DropdownMenu.Portal>
        <DropdownMenu.Content class="transcript-menu" data-keyboard={keyboard.current} bind:ref={content} customAnchor={anchor}
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
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
    }
    :global(.transcript-menu [data-disabled]) {
        cursor: default;
        opacity: .5;
        pointer-events: none;
    }
    :global(.transcript-menu[data-keyboard="false"] .focusable:focus-visible) {
        outline: none;
    }
</style>

<script lang="ts">
    import { onDestroy, tick, untrack } from "svelte";
    import { DropdownMenu, IsUsingKeyboard } from "bits-ui";
    import { type EditAction } from "../../../shared/app";
    import { transcriptMenuClipboardActions, restoreTranscriptMenuSelection, type TranscriptMenuRequest } from "../../editor/menuTarget";
    import { dismissTranscriptMenu, toggleTranscriptDeletion } from "../../editor/transcript";
    import { commandDisabled, commandLabel, runCommand, type Command } from "../../states/commands";
    import { editAvailable, runEdit } from "../../edit";
    import { editShortcut } from "../../keybindings";
    import * as project from "../../states/project.svelte";
    import * as modal from "../../states/modal.svelte";
    import * as i18n from "../../i18n.svelte";

    let request = $state.raw<TranscriptMenuRequest | null>(null);
    let open = $state(false);
    let content = $state<HTMLDivElement | null>(null);
    const keyboard = new IsUsingKeyboard();
    const actions = $derived(request ? transcriptMenuClipboardActions(request.target) : []);
    const restoreCommand = $derived(request?.target.kind === "deletion" && request.target.information
        ? { kind: "restoreTranscriptDeletion", target: request.view.dom, key: request.target.information.key } satisfies Command : null);
    const anchor = $derived(request ? { getBoundingClientRect: () => request!.anchor } : undefined);
    const layer = Symbol();
    const layerIndex = $derived(modal.getLayerIndex(layer));

    export function show(value: TranscriptMenuRequest | null): boolean {
        if (!value) {
            open = false;
            return false;
        }
        if (value.target.kind !== "deletion" && !transcriptMenuClipboardActions(value.target).length) return false;
        request = value;
        keyboard.current = value.keyboard;
        open = true;
        return true;
    }

    function changeOpen(value: boolean): void {
        open = value;
        if (!value && request) dismissTranscriptMenu(request.view.dom);
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

    function focusMenu(event: Event): void {
        event.preventDefault();
        const target = keyboard.current ? content?.querySelector<HTMLElement>("[role=\"menuitem\"]:not([data-disabled])") ?? content : content;
        target?.focus({ preventScroll: true });
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