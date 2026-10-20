<svelte:window
    onkeydowncapture={handleKeydown}
    onkeyupcapture={handleKeyup}
    onpointerdowncapture={cancelShortcuts}
    onblur={cancelShortcuts}
/>

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
                    <Menubar.Content data-keyboard={keyboard.current} bind:ref={menuContents.all} onOpenAutoFocus={handleMenuOpenAutoFocus} align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
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
                    <Menubar.SubContent data-keyboard={keyboard.current} align="start" sideOffset={8}>
                        {@render menu.items()}
                    </Menubar.SubContent>
                </Menubar.Portal>
            </Menubar.Sub>
        {:else}
            <Menubar.Menu value={menu.value}>
                <Menubar.Trigger class="menu-trigger hoverable activable focusable">{i18n.t(menu.label)}</Menubar.Trigger>
                <Menubar.Portal>
                    <Menubar.Content data-keyboard={keyboard.current} bind:ref={menuContents[menu.value]} onOpenAutoFocus={handleMenuOpenAutoFocus} align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                        {@render menu.items()}
                    </Menubar.Content>
                </Menubar.Portal>
            </Menubar.Menu>
        {/if}
    {/each}
{/snippet}

{#snippet projectItems()}
    <Menubar.Item class="activable focusable"
        disabled={fileActionDisabled({ kind: "newProject" })}
        onSelect={() => runFileAction({ kind: "newProject" })}
    >
        <div>{i18n.t("menu.project.new")}</div>
        <kbd>{modKeyText}+N</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={fileActionDisabled({ kind: "openProject" })}
        onSelect={() => runFileAction({ kind: "openProject" })}
    >
        <div>{i18n.t("menu.project.open")}</div>
        <kbd>{modKeyText}+O</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={fileActionDisabled({ kind: "saveProject" })}
        onSelect={() => runFileAction({ kind: "saveProject" })}
    >
        <div>{i18n.t("common.save")}</div>
        <kbd>{modKeyText}+S</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={fileActionDisabled({ kind: "saveProjectAs" })}
        onSelect={() => runFileAction({ kind: "saveProjectAs" })}
    >
        <div>{i18n.t("menu.project.saveAs")}</div>
        <kbd>{modKeyText}+⇧+S</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={fileActionDisabled({ kind: "closeProject" })}
        onSelect={() => runFileAction({ kind: "closeProject" })}
    >
        <div>{i18n.t("common.close")}</div>
        <kbd>{modKeyText}+W</kbd>
    </Menubar.Item>
{/snippet}

{#snippet mediaItems()}
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "importMedia" })}
        onSelect={() => runMenuCommand({ kind: "importMedia" })}
    >
        <div>{i18n.t("menu.media.import")}</div>
        <kbd>{modKeyText}+I</kbd>
    </Menubar.Item>
    <Menubar.Separator />
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled(transcriptionCommand)}
        onSelect={() => runMenuCommand(transcriptionCommand)}
    >
        <div>{i18n.t(transcriptionActionKeys[transcription.getAction(mediaSelection.get())])}</div>
        {#if transcriptionCommand.kind === "openTranscriptionConfig"}<kbd>{modKeyText}+B</kbd>{/if}
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={selectedMediaId === null}
        closeOnSelect={false}
        onSelect={handleRemoveMedia}
    >
        <div>{removalConfirmation !== null && removalConfirmation === selectedMediaId ? i18n.t("common.confirmAgain") : i18n.t("media.actions.remove")}</div>
    </Menubar.Item>
    <Menubar.Separator />
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "selectAdjacentMedia", direction: -1 })}
        onSelect={() => runMenuCommand({ kind: "selectAdjacentMedia", direction: -1 })}
    >
        <div>{i18n.t("player.actions.previousMedia")}</div>
        <kbd>{modKeyText}+⇧+←</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "selectAdjacentMedia", direction: 1 })}
        onSelect={() => runMenuCommand({ kind: "selectAdjacentMedia", direction: 1 })}
    >
        <div>{i18n.t("player.actions.nextMedia")}</div>
        <kbd>{modKeyText}+⇧+→</kbd>
    </Menubar.Item>
{/snippet}

{#snippet transcriptionItems()}
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "openPanel", panel: "transcription-backends" })}
        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "transcription-backends" })}
    >
        <div>{i18n.t("transcription.backends.actions.manage")}</div>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "openPanel", panel: "transcription-models" })}
        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "transcription-models" })}
    >
        <div>{i18n.t("transcription.models.actions.manage")}</div>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "openPanel", panel: "transcription-presets" })}
        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "transcription-presets" })}
    >
        <div>{i18n.t("transcription.presets.actions.manage")}</div>
    </Menubar.Item>
    <Menubar.Separator />
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "openPanel", panel: "vocabulary" })}
        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "vocabulary" })}
    >
        <div>{i18n.t("transcription.vocabulary.title")}</div>
        <kbd>{modKeyText}+L</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "openPanel", panel: "tasks" })}
        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "tasks" })}
    >
        <div>{i18n.t("transcription.tasks.title")}</div>
        <kbd>{modKeyText}+T</kbd>
    </Menubar.Item>
{/snippet}

{#snippet editItems()}
    <Menubar.Item class="activable focusable"
        disabled={false}
        onSelect={() => {}}
    >
        <div>{i18n.t("menu.edit.selectAll")}</div>
        <kbd>{modKeyText}+A</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable" onSelect={() => runEdit("undo")}>
        <div>{i18n.t("menu.edit.undo")}</div>
        <kbd>{modKeyText}+Z</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable" onSelect={() => runEdit("redo")}>
        <div>{i18n.t("menu.edit.redo")}</div>
        <kbd>{modKeyText}+Y</kbd>
    </Menubar.Item>
    <Menubar.Separator />
    <Menubar.Item class="activable focusable" onSelect={() => runEdit("cut")}>
        <div>{i18n.t("menu.edit.cut")}</div>
        <kbd>{modKeyText}+X</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable" onSelect={() => runEdit("copy")}>
        <div>{i18n.t("menu.edit.copy")}</div>
        <kbd>{modKeyText}+C</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable" onSelect={() => runEdit("paste")}>
        <div>{i18n.t("menu.edit.paste")}</div>
        <kbd>{modKeyText}+V</kbd>
    </Menubar.Item>
{/snippet}

{#snippet playItems()}
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "playSelectedMedia" })}
        onSelect={() => runMenuCommand({ kind: "playSelectedMedia" })}
    >
        <div>{player.isPlaying() ? i18n.t("player.actions.pause") : i18n.t("player.actions.play")}</div>
        <kbd>Space</kbd>
    </Menubar.Item>
    <Menubar.Separator />
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "toggleVolumeStabilization" })}
        onSelect={() => runMenuCommand({ kind: "toggleVolumeStabilization" })}
    >
        <div>{player.isVolumeStabilizationEnabled() ? i18n.t("player.actions.disableStabilization") : i18n.t("player.actions.enableStabilization")}</div>
        <kbd>{modKeyText}+E</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "restorePlaybackSpeed" })}
        onSelect={() => runMenuCommand({ kind: "restorePlaybackSpeed" })}
    >
        <div>{i18n.t("player.actions.restoreSpeed")}</div>
        <kbd>{modKeyText}+R</kbd>
    </Menubar.Item>
    <Menubar.Separator />
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "seekAdjacentWord", direction: -1 })}
        onSelect={() => runMenuCommand({ kind: "seekAdjacentWord", direction: -1 })}
    >
        <div>{i18n.t("player.actions.previousWord")}</div>
        <kbd>{modKeyText}+←</kbd>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "seekAdjacentWord", direction: 1 })}
        onSelect={() => runMenuCommand({ kind: "seekAdjacentWord", direction: 1 })}
    >
        <div>{i18n.t("player.actions.nextWord")}</div>
        <kbd>{modKeyText}+→</kbd>
    </Menubar.Item>
{/snippet}

{#snippet miscItems()}
    <Menubar.Item class="activable focusable"
        disabled={fileActionDisabled({ kind: "quitApp" })}
        onSelect={() => runFileAction({ kind: "quitApp" })}
    >
        <div>{i18n.t("menu.other.quit")}</div>
        <kbd>{modKeyText}+Q</kbd>
    </Menubar.Item>
    <Menubar.Separator />
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "openPanel", panel: "settings" })}
        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "settings" })}
    >
        <div>{i18n.t("settings.title")}</div>
        <kbd>{modKeyText}+,</kbd>
    </Menubar.Item>
    <Menubar.Separator />
    <Menubar.Item class="activable focusable"
        onSelect={() => runCommand({ kind: "openDevTools" })}
    >
        <div>{i18n.t("menu.other.developerTools")}</div>
        <kbd>F12</kbd>
    </Menubar.Item>
    <Menubar.Separator />
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "openPanel", panel: "guide" })}
        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "guide" })}
    >
        <div>{i18n.t("guide.title")}</div>
    </Menubar.Item>
    <Menubar.Item class="activable focusable" onSelect={() => runMenuCommand({ kind: "openProjectRepository" })}>
        <div class="external-link">
            <span>{i18n.t("menu.other.repository")}</span>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html externalLinkIcon}
        </div>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "openPanel", panel: "licenses" })}
        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "licenses" })}
    >
        <div>{i18n.t("licenses.title")}</div>
    </Menubar.Item>
    <Menubar.Item class="activable focusable"
        disabled={commandDisabled({ kind: "openPanel", panel: "about" })}
        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "about" })}
    >
        <div>{i18n.t("menu.other.about")}</div>
    </Menubar.Item>
{/snippet}


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
    import { onDestroy, untrack } from "svelte";
    import { type ParseKeys } from "i18next";
    import { IsUsingKeyboard, Menubar } from "bits-ui";
    import ProjectStatus from "./ProjectStatus.svelte";
    import menuIcon from "../../../resources/icons/carbon--menu.svg?raw";
    import chevronRight from "../../../resources/icons/carbon--chevron-right.svg?raw";
    import externalLinkIcon from "../../../resources/icons/cil--external-link.svg?raw";
    import { commandDisabled, runCommand, interfaceBlocked, type Command } from "../../states/commands";
    import { type EditAction } from "../../../shared/app";
    import { handleTranscriptEdit } from "../../editor/transcript";
    import * as transcription from "../../states/transcription.svelte";
    import * as player from "../../states/player.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as transcript from "../../states/transcript.svelte";
    import * as menu from "../../states/menu.svelte";
    import * as transcriptAPI from "../../states/transcript";

    const transcriptionActionKeys = {
        start: "transcription.actions.new",
        "review-failure": "transcription.actions.reviewFailure",
        "cancel-queued": "transcription.actions.cancelQueued",
        stopping: "transcription.tasks.status.stopping",
        stop: "transcription.actions.stop"
    } as const satisfies Record<transcription.TranscriptionAction, ParseKeys>;

    const selectedMediaId = $derived(mediaSelection.get());
    const selectedTask = $derived(selectedMediaId ? transcription.getTask(selectedMediaId) : null);
    const transcriptionCommand = $derived<Command>({
        kind: selectedTask?.status === "failed" ? "reviewTranscriptionError" : transcription.isPending(selectedTask) ? "stopTranscription" : "openTranscriptionConfig",
        mediaId: selectedMediaId
    });
    const isMac = window.api.platform === "darwin";
    const modKeyText = isMac ? "⌘" : "Ctrl";
    const shortcuts: Record<string, Command> = {
        n: { kind: "newProject" },
        o: { kind: "openProject" },
        s: { kind: "saveProject" },
        w: { kind: "closeProject" },
        q: { kind: "quitApp" },
        i: { kind: "importMedia" },
        r: { kind: "restorePlaybackSpeed" },
        e: { kind: "toggleVolumeStabilization" },
        l: { kind: "openPanel", panel: "vocabulary" },
        t: { kind: "openPanel", panel: "tasks" },
        ",": { kind: "openPanel", panel: "settings" }
    };

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
    let pendingAlt = false;
    let wordNavigation: {
        direction: -1 | 1;
        mediaId: string | null;
        starts: readonly number[];
        index: number;
        seekVersion: number;
    } | null = null;
    let focusMenuOnOpen = false;
    let editor: HTMLElement | null = null;
    let editorRange: Range | null = null;
    let editorSelection: { start: number; end: number; direction: "forward" | "backward" | "none" } | null = null;
    let restoringEditor = false;
    let focusingControl = false;
    let removalConfirmation = $state<string | null>(null);

    onDestroy(() => menu.set(""));

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
        editor = active instanceof HTMLElement && (active.matches("input, textarea") || active.isContentEditable) ? active : null;
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
        if (menuBlocked()) return;
        restoringEditor = true;
        menu.set("");
        restoreEditor();
        if (!handleTranscriptEdit(editor, action)) window.api.edit(action);
    }

    function menuBlocked(): boolean {
        return interfaceBlocked();
    }

    function fileActionDisabled(action: Command): boolean {
        return commandDisabled(action);
    }

    function runFileAction(action: Command): void {
        runMenuCommand(action);
    }

    function runMenuCommand(action: Command): void {
        if (menuBlocked() || fileActionDisabled(action)) return;
        focusingControl = menu.get() !== "" && action.kind === "focus";
        menu.set("");
        runCommand(action);
    }

    function handleRemoveMedia(): void {
        if (menuBlocked() || selectedMediaId === null) return;
        if (removalConfirmation === selectedMediaId) runMenuCommand({ kind: "removeMedia", mediaId: selectedMediaId });
        else removalConfirmation = selectedMediaId;
    }

    function isEditingTarget(target: EventTarget | null): boolean {
        return target instanceof HTMLElement && (target.closest("input, textarea") !== null || target.isContentEditable);
    }

    function preventSpaceActivation(event: KeyboardEvent): void {
        if (event.key !== " " || event.isComposing || isEditingTarget(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
    }

    function runWordShortcut(direction: -1 | 1, repeat: boolean): void {
        if (menuBlocked() || !player.getURL()) {
            wordNavigation = null;
            return;
        }
        const mediaId = mediaSelection.get();
        const starts = transcript.getWordStarts();
        const seekVersion = player.getSeekVersion();
        // Only this held key's own seeks may continue from the saved word index.
        if (!repeat || !wordNavigation || wordNavigation.direction !== direction || wordNavigation.mediaId !== mediaId
            || wordNavigation.starts !== starts || wordNavigation.seekVersion !== seekVersion) {
            wordNavigation = { direction, mediaId, starts, index: transcriptAPI.getWordIndex(player.getCurrentTime()), seekVersion };
        }
        const navigation = wordNavigation;
        runFileAction({ kind: "seekAdjacentWord", direction, fromWordIndex: navigation.index });
        const nextVersion = player.getSeekVersion();
        if (nextVersion === seekVersion + 1) {
            navigation.index += direction;
            navigation.seekVersion = nextVersion;
        }
        else if (nextVersion !== seekVersion) wordNavigation = null;
    }

    function handleFileShortcut(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.isComposing || event.altKey || event.getModifierState("AltGraph")) {
            wordNavigation = null;
            return;
        }
        const command = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
        const key = event.key.toLowerCase();
        const editing = isEditingTarget(event.target);
        let action: Command | undefined;
        if (command) {
            if (event.shiftKey) {
                action = key === "s" ? { kind: "saveProjectAs" }
                    : key === "p" ? { kind: "focus", target: "playback-progress" }
                    : key === "r" ? { kind: "focus", target: "playback-speed" }
                    : key === "e" ? { kind: "focus", target: "playback-volume" } : undefined;
            }
            else action = key === "b" ? { kind: "openTranscriptionConfig", mediaId: selectedMediaId } : shortcuts[key];
            if (!editing && (key === "arrowleft" || key === "arrowright")) {
                action = { kind: event.shiftKey ? "selectAdjacentMedia" : "seekAdjacentWord", direction: key === "arrowleft" ? -1 : 1 };
            }
        }
        else if (!editing && !event.ctrlKey && !event.metaKey && !event.shiftKey && key === " ") action = { kind: "playSelectedMedia" };
        if (action?.kind !== "seekAdjacentWord") wordNavigation = null;
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        if (action.kind === "seekAdjacentWord") runWordShortcut(action.direction, event.repeat);
        else if (!event.repeat) runFileAction(action);
    }

    function cancelAlt(): void {
        pendingAlt = false;
    }

    function cancelShortcuts(): void {
        cancelAlt();
        wordNavigation = null;
    }

    function handleKeydown(event: KeyboardEvent): void {
        // Shortcuts stop propagation before reaching Bits UI's document listener.
        keyboard.current = true;
        if (event.key !== "Alt") {
            cancelAlt();
            handleFileShortcut(event);
            preventSpaceActivation(event);
            return;
        }
        if (event.repeat) return;
        wordNavigation = null;
        pendingAlt = !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey
            && !event.isComposing && !event.getModifierState("AltGraph") && !menuBlocked();
    }

    function handleKeyup(event: KeyboardEvent): void {
        if (wordNavigation && (event.key === (wordNavigation.direction === -1 ? "ArrowLeft" : "ArrowRight")
            || event.key === (isMac ? "Meta" : "Control"))) wordNavigation = null;
        preventSpaceActivation(event);
        const toggle = pendingAlt && event.key === "Alt" && !event.defaultPrevented
            && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.isComposing
            && !event.getModifierState("AltGraph") && !menuBlocked();
        cancelAlt();
        if (!toggle) return;
        event.preventDefault();
        if (menu.get()) {
            menu.set("");
        }
        else {
            rememberEditor();
            focusMenuOnOpen = true;
            menu.set(compact ? "all" : "project");
        }
    }

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
        if (menu.get() || menuBlocked() || restoringEditor || focusingControl) {
            event.preventDefault();
        }
        else if (editor?.isConnected) {
            event.preventDefault();
            restoreEditor();
        }
        restoringEditor = false;
        focusingControl = false;
    }
</script>