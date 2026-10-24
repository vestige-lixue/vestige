<svelte:window onpointerdowncapture={handlePointerdown} />

<header class="menu-bar" class:compact
    bind:contentRect={menuBarBounds}
    style:--menu-item-padding={`${menuPadding}px`}
>
    <Menubar.Root class="menu" data-keyboard={keyboard.current} bind:value={menu.get, menu.set} onpointerdowncapture={rememberEditor}>
        {#if compact}
            <Menubar.Menu value="all">
                <Menubar.Trigger class="menu-trigger menu-toggle hoverable activable focusable">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html menuIcon}
                </Menubar.Trigger>
                <Menubar.Portal>
                    <Menubar.Content data-keyboard={keyboard.current} bind:ref={menuContents.all} onOpenAutoFocus={handleMenuOpenAutoFocus} align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}
                        style={`z-index: ${layerIndex + 1};`} interactOutsideBehavior="ignore">
                        {@render menuGroups()}
                    </Menubar.Content>
                </Menubar.Portal>
            </Menubar.Menu>
        {:else}
            {@render menuGroups()}
        {/if}
    </Menubar.Root>
    <ProjectStatus bind:reservedWidth={projectReservedWidth} />
    <div class="measurement">
        <div class="menu-labels" bind:contentRect={menuTextBounds}>
            {#each menus as menu (menu.value)}<span>{i18n.t(menu.label)}</span>{/each}
        </div>
    </div>
</header>

{#snippet menuGroups()}
    {#each menus as menu (menu.value)}
        {#if compact}
            <Menubar.Sub onOpenChange={(open) => {
                if (menu.value === "media") mediaSubmenuOpen = open;
            }}>
                <Menubar.SubTrigger class="submenu-trigger activable focusable">
                    <div>{i18n.t(menu.label)}</div>
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html chevronRight}
                </Menubar.SubTrigger>
                <Menubar.Portal>
                    <Menubar.SubContent data-keyboard={keyboard.current} align="start" sideOffset={8} style={`z-index: ${layerIndex + 1};`}>
                        {@render menu.items()}
                    </Menubar.SubContent>
                </Menubar.Portal>
            </Menubar.Sub>
        {:else}
            <Menubar.Menu value={menu.value}>
                <Menubar.Trigger class="menu-trigger hoverable activable focusable">{i18n.t(menu.label)}</Menubar.Trigger>
                <Menubar.Portal>
                    <Menubar.Content data-keyboard={keyboard.current} bind:ref={menuContents[menu.value]} onOpenAutoFocus={handleMenuOpenAutoFocus} align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}
                        style={`z-index: ${layerIndex + 1};`} interactOutsideBehavior="ignore">
                        {@render menu.items()}
                    </Menubar.Content>
                </Menubar.Portal>
            </Menubar.Menu>
        {/if}
    {/each}
{/snippet}

{#snippet commandItems(actions: readonly (Command | null)[])}
    {#each actions as action, index (index)}
        {#if action === null}<Menubar.Separator />
        {:else}
            <Menubar.Item class="activable focusable" disabled={commandDisabled(action)} onSelect={() => runMenuCommand(action)}>
                <div class:external-link={action.kind === "openProjectRepository"}>
                    <span>{commandLabel(action)}</span>
                    {#if action.kind === "openProjectRepository"}
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html externalLinkIcon}
                    {/if}
                </div>
                {#if shortcut(action)}<kbd>{shortcut(action)}</kbd>{/if}
            </Menubar.Item>
        {/if}
    {/each}
{/snippet}

{#snippet projectItems()}{@render commandItems(projectActions)}{/snippet}

{#snippet mediaItems()}
    {@render commandItems([{ kind: "importMedia" }, null, transcriptionCommand])}
    <Menubar.Item class="activable focusable" disabled={selectedMediaId === null} closeOnSelect={false} onSelect={handleRemoveMedia}>
        <div>{removalConfirmation !== null && removalConfirmation === selectedMediaId ? i18n.t("common.confirmAgain") : i18n.t("media.actions.remove")}</div>
    </Menubar.Item>
    {@render commandItems([null, { kind: "moveSelectedMedia", direction: -1 }, { kind: "moveSelectedMedia", direction: 1 }])}
{/snippet}

{#snippet transcriptionItems()}{@render commandItems(transcriptionActions)}{/snippet}

{#snippet editItems()}
    {#each editActions as action, index (index)}
        {#if action === null}<Menubar.Separator />
        {:else}
            <Menubar.Item class="activable focusable" disabled={action === "undo" ? !canUndo : action === "redo" ? !canRedo : false} onSelect={() => runEdit(action)}>
                <div>{i18n.t(`menu.edit.${action}`)}</div>
                <kbd>{editShortcut(action)}</kbd>
            </Menubar.Item>
        {/if}
    {/each}
{/snippet}

{#snippet playItems()}{@render commandItems(playActions)}{/snippet}
{#snippet miscItems()}{@render commandItems(miscActions)}{/snippet}


<style>
    /* Scripted focus on hover or dismissal can retain Chromium's focus-visible state. */
    :global([data-menubar-root][data-keyboard="false"] .focusable:focus-visible),
    :global([data-menubar-content][data-keyboard="false"] .focusable:focus-visible) {
        outline: none;
    }
    .menu-bar {
        --menu-padding-inline: clamp(2px, calc(1.25vw - 6px), 8px);
        -webkit-app-region: drag;
        container-type: inline-size;
        display: flex;
        flex-flow: row nowrap;
        flex-shrink: 0;
        align-items: center;
        gap: 0;
        min-width: 0;
        height: env(titlebar-area-height);
        margin-bottom: var(--drag-region-margin);
        padding: 0 calc(100vw - env(titlebar-area-x) - env(titlebar-area-width) + var(--menu-padding-inline)) 0 var(--menu-padding-inline);
    }
    .menu-bar.compact {
        padding-left: 8px;
    }
    .measurement {
        position: absolute;
        width: 0;
        height: 0;
        overflow: hidden;
        visibility: hidden;
        pointer-events: none;
    }
    .menu-labels {
        display: flex;
        width: max-content;
    }
    .menu-labels,
    :global(.menu-trigger) {
        font-size: 15px;
        white-space: nowrap;
    }
    :global(.menu) {
        display: flex;
        flex: 0 0 auto;
        flex-flow: row nowrap;
        align-items: center;
        height: 100%;
        gap: 0;
    }
    :global(.menu-trigger) {
        -webkit-app-region: no-drag;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 70%;
        padding: 0 var(--menu-item-padding);
        border-radius: 8px;
    }
    :global(.menu-trigger.menu-toggle) {
        box-sizing: border-box;
        aspect-ratio: 1;
        padding: 0;
    }
    :global(.menu-toggle svg) {
        width: 20px;
        height: 20px;
    }
    :global(.submenu-trigger svg) {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
    }
    .external-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    .external-link :global(svg) {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
    }
    :global([data-menu-content]),
    :global([data-menubar-sub-content]) {
        --bg: var(--c-surface);
        font-size: 15px;
        display: flex;
        flex-flow: column nowrap;
        background: var(--bg);
        padding: 4px;
        border-radius: 8px;
        min-width: 190px;
        box-shadow:
            0 0 0 1px var(--c-shadow-1),
            0 2px 6px -2px var(--c-shadow-2),
            0 12px 28px -4px var(--c-shadow-3);
    }
    :global([data-menubar-separator]) {
        height: 1px;
        margin: 4px 0;
        background: var(--c-border-110p);
    }
    :global([data-menubar-item]) {
        font-size: 14px;
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 8px;
        cursor: pointer;
    }
    :global([data-menubar-item][data-disabled]) {
        cursor: default;
        opacity: 0.5;
        pointer-events: none;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { dismissOutside } from "../../dom";
    import { flushSync, onDestroy, onMount, tick, untrack } from "svelte";
    import { IsUsingKeyboard, Menubar } from "bits-ui";
    import ProjectStatus from "./ProjectStatus.svelte";
    import menuIcon from "../../../resources/icons/carbon--menu.svg?raw";
    import chevronRight from "../../../resources/icons/carbon--chevron-right.svg?raw";
    import externalLinkIcon from "../../../resources/icons/cil--external-link.svg?raw";
    import { commandDisabled, commandLabel, runCommand, interfaceBlocked, type Command } from "../../states/commands";
    import { type EditAction } from "../../../shared/app";
    import { editAvailable, runEdit as performEdit } from "../../edit";
    import { isTranscriptEditorTarget } from "../../editor/transcript";
    import { shortcut, editShortcut, registerMenu } from "../../keybindings";
    import * as transcription from "../../states/transcription.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as menu from "../../states/menu.svelte";
    import * as modal from "../../states/modal.svelte";

    const selectedMediaId = $derived(mediaSelection.get());
    const selectedTask = $derived(selectedMediaId ? transcription.getTask(selectedMediaId) : null);
    const transcriptionCommand = $derived<Command>({
        kind: selectedTask?.status === "failed" ? "reviewTranscriptionError" : transcription.isPending(selectedTask) ? "stopTranscription" : "openTranscriptionConfig",
        mediaId: selectedMediaId
    });
    const projectActions: readonly (Command | null)[] = [
        { kind: "newProject" }, { kind: "openProject" }, { kind: "saveProject" }, { kind: "saveProjectAs" }, { kind: "closeProject" }
    ];
    const transcriptionActions: readonly (Command | null)[] = [
        { kind: "openPanel", panel: "transcription-backends" }, { kind: "openPanel", panel: "transcription-models" },
        { kind: "openPanel", panel: "transcription-presets" }, null, { kind: "openPanel", panel: "vocabulary" }, { kind: "openPanel", panel: "tasks" }
    ];
    const editActions: readonly (EditAction | null)[] = ["selectAll", "undo", "redo", null, "cut", "copy", "paste"];
    const playActions: readonly (Command | null)[] = [
        { kind: "playSelectedMedia" }, { kind: "cyclePlaybackMode" }, null,
        { kind: "selectAdjacentMedia", direction: -1 }, { kind: "selectAdjacentMedia", direction: 1 }, null,
        { kind: "seekAdjacentWord", direction: -1 }, { kind: "seekAdjacentWord", direction: 1 }, null,
        { kind: "toggleVolumeStabilization" }, { kind: "restorePlaybackSpeed" }
    ];
    const miscActions: readonly (Command | null)[] = [
        { kind: "quitApp" }, null, { kind: "openPanel", panel: "settings" }, null, { kind: "openDevTools" }, null,
        { kind: "openPanel", panel: "guide" }, { kind: "openProjectRepository" }, { kind: "openPanel", panel: "licenses" }, { kind: "openPanel", panel: "about" }
    ];

    const menus = [
        { value: "project", label: "menu.project.title", items: projectItems },
        { value: "media", label: "menu.media.title", items: mediaItems },
        { value: "transcription", label: "menu.transcription.title", items: transcriptionItems },
        { value: "edit", label: "menu.edit.title", items: editItems },
        { value: "play", label: "menu.playback.title", items: playItems },
        { value: "misc", label: "menu.other.title", items: miscItems }
    ] as const;

    const keyboard = new IsUsingKeyboard();
    let menuBarBounds = $state<DOMRectReadOnly>();
    let menuTextBounds = $state<DOMRectReadOnly>();
    let projectReservedWidth = $state(0);
    let menuPadding = $state(16);
    let compact = $state(false);
    let mediaSubmenuOpen = $state(false);
    let menuContents = $state<Record<(typeof menus)[number]["value"] | "all", HTMLDivElement | null>>({
        all: null,
        project: null,
        media: null,
        transcription: null,
        edit: null,
        play: null,
        misc: null
    });
    let focusMenuOnOpen = false;
    let editor: HTMLElement | null = null;
    let canUndo = $state(false);
    let canRedo = $state(false);
    let editorRange: Range | null = null;
    let editorSelection: { start: number; end: number; direction: "forward" | "backward" | "none" } | null = null;
    let restoringEditor = false;
    let focusingControl = false;
    let pointerDismissed = false;
    let removalConfirmation = $state<string | null>(null);

    const layer = Symbol();
    const layerIndex = $derived(modal.getLayerIndex(layer));

    $effect.pre(() => {
        if (menu.get()) untrack(() => modal.openLayer(layer));
        else untrack(() => modal.closeLayer(layer));
    });
    onDestroy(() => {
        menu.set("");
        modal.closeLayer(layer);
    });

    $effect(() => {
        const mediaMenuOpen = compact ? menu.get() === "all" && mediaSubmenuOpen : menu.get() === "media";
        if (!mediaMenuOpen || selectedMediaId !== removalConfirmation || interfaceBlocked()) removalConfirmation = null;
    });

    $effect(() => {
        if (!menuBarBounds || !menuTextBounds) return;
        const availableWidth = menuBarBounds.width - projectReservedWidth;
        const menuTextWidth = menuTextBounds.width;
        menuPadding = Math.max(4, Math.min(16, (availableWidth - menuTextWidth) / (menus.length * 2)));
        const wasCompact = untrack(() => compact);
        // Leave room before expanding again so rounding and padding changes cannot toggle the layout repeatedly.
        const nextCompact = availableWidth < menuTextWidth + menus.length * 8 + (wasCompact ? 12 : 0);
        if (wasCompact === nextCompact) return;
        menu.set("");
        mediaSubmenuOpen = false;
        focusMenuOnOpen = false;
        compact = nextCompact;
    });

    function rememberEditor(): void {
        if (menu.get()) return;
        const active = document.activeElement;
        editor = active instanceof HTMLElement && (active.matches("input, textarea") || active.isContentEditable || isTranscriptEditorTarget(active)) ? active : null;
        canUndo = editAvailable(editor, "undo");
        canRedo = editAvailable(editor, "redo");
        editorSelection = (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) && editor.selectionStart !== null && editor.selectionEnd !== null
            ? { start: editor.selectionStart, end: editor.selectionEnd, direction: editor.selectionDirection ?? "none" } : null;
        const selection = document.getSelection();
        editorRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    }

    function restoreEditor(): void {
        if (editor?.isConnected) editor.focus({ preventScroll: true });
        if (editorSelection && (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement)) {
            editor.setSelectionRange(editorSelection.start, editorSelection.end, editorSelection.direction);
        }
        else if (editorRange?.startContainer.isConnected && editorRange.endContainer.isConnected) {
            const selection = document.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(editorRange);
        }
    }

    function runEdit(action: EditAction): void {
        if (interfaceBlocked() || action === "undo" && !canUndo || action === "redo" && !canRedo) return;
        restoringEditor = true;
        menu.set("");
        void tick().then(() => {
            restoreEditor();
            performEdit(editor, action);
        });
    }

    function runMenuCommand(action: Command): void {
        if (interfaceBlocked() || commandDisabled(action)) return;
        focusingControl = menu.get() !== "" && action.kind === "focus";
        menu.set("");
        runCommand(action);
    }

    function handleRemoveMedia(): void {
        if (interfaceBlocked() || selectedMediaId === null) return;
        if (removalConfirmation === selectedMediaId) runMenuCommand({ kind: "removeMedia", mediaId: selectedMediaId });
        else removalConfirmation = selectedMediaId;
    }

    function handlePointerdown(event: PointerEvent): void {
        if (!menu.get()) return;
        dismissOutside(event, target => !(target instanceof Element)
            || target.closest("[data-menubar-trigger], [data-menubar-content], [data-menubar-sub-content]") !== null, () => {
                pointerDismissed = true;
                flushSync(() => menu.set(""));
            });
    }

    onMount(() => registerMenu({
        keyboard: () => keyboard.current = true,
        run: runMenuCommand,
        edit: runEdit,
        toggle: () => {
            if (menu.get()) menu.set("");
            else {
                rememberEditor();
                focusMenuOnOpen = true;
                menu.set(compact ? "all" : "project");
            }
        }
    }));

    function handleMenuOpenAutoFocus(event: Event): void {
        if (!focusMenuOnOpen) return;
        focusMenuOnOpen = false;
        const content = menuContents[compact ? "all" : "project"];
        const firstItem = content?.querySelector<HTMLElement>("[data-menubar-item]:not([data-disabled])");
        if (!firstItem) return;
        event.preventDefault();
        firstItem.focus({ preventScroll: true });
    }

    function handleCloseAutoFocus(event: Event): void {
        // Switching menus or opening a dialog must keep focus in the new content.
        if (menu.get() || interfaceBlocked() || restoringEditor || focusingControl || pointerDismissed) {
            event.preventDefault();
        }
        else if (editor?.isConnected) {
            event.preventDefault();
            restoreEditor();
        }
        restoringEditor = false;
        focusingControl = false;
        pointerDismissed = false;
    }
</script>