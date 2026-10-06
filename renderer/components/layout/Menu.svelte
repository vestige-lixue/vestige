<svelte:window
    onkeydowncapture={handleKeydown}
    onkeyupcapture={handleKeyup}
    onpointerdowncapture={cancelAlt}
    onblur={cancelAlt}
/>

<header class="menu-bar">
    <Menubar.Root class="menu" data-keyboard={keyboard.current} bind:value={activeMenu} onpointerdowncapture={rememberEditor}>
        <Menubar.Menu value="project">
            <Menubar.Trigger class="menu-trigger hoverable activable focusable">{i18n.t("menu.project")}</Menubar.Trigger>
            <Menubar.Portal>
                <Menubar.Content data-keyboard={keyboard.current} bind:ref={fileContent} onOpenAutoFocus={handleFileOpenAutoFocus} align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                    <Menubar.Item class="activable focusable"
                        disabled={fileActionDisabled({ kind: "newProject" })}
                        onSelect={() => runFileAction({ kind: "newProject" })}
                    >
                        <div>{i18n.t("menu.new")}</div>
                        <kbd>{modKeyText}+N</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable"
                        disabled={fileActionDisabled({ kind: "openProject" })}
                        onSelect={() => runFileAction({ kind: "openProject" })}
                    >
                        <div>{i18n.t("menu.open")}</div>
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
                        <div>{i18n.t("menu.saveAs")}</div>
                        <kbd>{modKeyText}+⇧+S</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable"
                        disabled={fileActionDisabled({ kind: "closeProject" })}
                        onSelect={() => runFileAction({ kind: "closeProject" })}
                    >
                        <div>{i18n.t("common.close")}</div>
                        <kbd>{modKeyText}+W</kbd>
                    </Menubar.Item>
                </Menubar.Content>
            </Menubar.Portal>
        </Menubar.Menu>
        <Menubar.Menu value="media">
            <Menubar.Trigger class="menu-trigger hoverable activable focusable">{i18n.t("menu.media")}</Menubar.Trigger>
            <Menubar.Portal>
                <Menubar.Content data-keyboard={keyboard.current} align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "importMedia" })}
                        onSelect={() => runMenuCommand({ kind: "importMedia" })}
                    >
                        <div>{i18n.t("menu.import")}</div>
                        <kbd>{modKeyText}+I</kbd>
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled(transcriptionCommand)}
                        onSelect={() => runMenuCommand(transcriptionCommand)}
                    >
                        <div>{transcriptionLabel(transcription.getAction(mediaSelection.get()))}</div>
                        <kbd>{modKeyText}+B</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable"
                        disabled={selectedMediaId === null}
                        closeOnSelect={false}
                        onSelect={handleRemoveMedia}
                    >
                        <div>{removalConfirmation !== null && removalConfirmation === selectedMediaId ? i18n.t("common.confirmAgain") : i18n.t("media.remove")}</div>
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "selectAdjacentMedia", direction: -1 })}
                        onSelect={() => runMenuCommand({ kind: "selectAdjacentMedia", direction: -1 })}
                    >
                        <div>{i18n.t("player.previousMedia")}</div>
                        <kbd>{modKeyText}+⇧+←</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "selectAdjacentMedia", direction: 1 })}
                        onSelect={() => runMenuCommand({ kind: "selectAdjacentMedia", direction: 1 })}
                    >
                        <div>{i18n.t("player.nextMedia")}</div>
                        <kbd>{modKeyText}+⇧+→</kbd>
                    </Menubar.Item>
                </Menubar.Content>
            </Menubar.Portal>
        </Menubar.Menu>
        <Menubar.Menu value="edit">
            <Menubar.Trigger class="menu-trigger hoverable activable focusable">{i18n.t("menu.edit")}</Menubar.Trigger>
            <Menubar.Portal>
                <Menubar.Content data-keyboard={keyboard.current} align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                    <Menubar.Item class="activable focusable"
                        disabled={false}
                        onSelect={() => {}}
                    >
                        <div>{i18n.t("menu.selectAll")}</div>
                        <kbd>{modKeyText}+A</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable" onSelect={() => runEdit("undo")}>
                        <div>{i18n.t("menu.undo")}</div>
                        <kbd>{modKeyText}+Z</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable" onSelect={() => runEdit("redo")}>
                        <div>{i18n.t("menu.redo")}</div>
                        <kbd>{modKeyText}+Y</kbd>
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item class="activable focusable" onSelect={() => runEdit("cut")}>
                        <div>{i18n.t("menu.cut")}</div>
                        <kbd>{modKeyText}+X</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable" onSelect={() => runEdit("copy")}>
                        <div>{i18n.t("menu.copy")}</div>
                        <kbd>{modKeyText}+C</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable" onSelect={() => runEdit("paste")}>
                        <div>{i18n.t("menu.paste")}</div>
                        <kbd>{modKeyText}+V</kbd>
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "openPanel", panel: "vocabulary" })}
                        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "vocabulary" })}
                    >
                        <div>{i18n.t("dialogs.vocabulary")}</div>
                        <kbd>{modKeyText}+L</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "openPanel", panel: "tasks" })}
                        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "tasks" })}
                    >
                        <div>{i18n.t("transcription.tasks")}</div>
                        <kbd>{modKeyText}+T</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "openPanel", panel: "settings" })}
                        onSelect={() => runMenuCommand({ kind: "openPanel", panel: "settings" })}
                    >
                        <div>{i18n.t("settings.title")}</div>
                        <kbd>{modKeyText}+,</kbd>
                    </Menubar.Item>
                </Menubar.Content>
            </Menubar.Portal>
        </Menubar.Menu>
        <Menubar.Menu value="play">
            <Menubar.Trigger class="menu-trigger hoverable activable focusable">{i18n.t("menu.playback")}</Menubar.Trigger>
            <Menubar.Portal>
                <Menubar.Content data-keyboard={keyboard.current} align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "playSelectedMedia" })}
                        onSelect={() => runMenuCommand({ kind: "playSelectedMedia" })}
                    >
                        <div>{player.isPlaying() ? i18n.t("player.pause") : i18n.t("player.play")}</div>
                        <kbd>Space</kbd>
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "toggleVolumeStabilization" })}
                        onSelect={() => runMenuCommand({ kind: "toggleVolumeStabilization" })}
                    >
                        <div>{player.isVolumeStabilizationEnabled() ? i18n.t("player.disableStabilization") : i18n.t("player.enableStabilization")}</div>
                        <kbd>{modKeyText}+E</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "restorePlaybackSpeed" })}
                        onSelect={() => runMenuCommand({ kind: "restorePlaybackSpeed" })}
                    >
                        <div>{i18n.t("player.restoreSpeed")}</div>
                        <kbd>{modKeyText}+R</kbd>
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "seekAdjacentWord", direction: -1 })}
                        onSelect={() => runMenuCommand({ kind: "seekAdjacentWord", direction: -1 })}
                    >
                        <div>{i18n.t("player.previousWord")}</div>
                        <kbd>{modKeyText}+←</kbd>
                    </Menubar.Item>
                    <Menubar.Item class="activable focusable"
                        disabled={commandDisabled({ kind: "seekAdjacentWord", direction: 1 })}
                        onSelect={() => runMenuCommand({ kind: "seekAdjacentWord", direction: 1 })}
                    >
                        <div>{i18n.t("player.nextWord")}</div>
                        <kbd>{modKeyText}+→</kbd>
                    </Menubar.Item>
                </Menubar.Content>
            </Menubar.Portal>
        </Menubar.Menu>
        <Menubar.Menu value="misc">
            <Menubar.Trigger class="menu-trigger hoverable activable focusable">{i18n.t("menu.other")}</Menubar.Trigger>
            <Menubar.Portal>
                <Menubar.Content data-keyboard={keyboard.current} align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                    <Menubar.Item class="activable focusable"
                        disabled={fileActionDisabled({ kind: "quitApp" })}
                        onSelect={() => runFileAction({ kind: "quitApp" })}
                    >
                        <div>{i18n.t("menu.quit")}</div>
                        <kbd>{modKeyText}+Q</kbd>
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item class="activable focusable"
                        onSelect={() => runCommand({ kind: "openDevTools" })}
                    >
                        <div>{i18n.t("menu.developerTools")}</div>
                        <kbd>F12</kbd>
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item class="activable focusable" onSelect={() => runMenuCommand({ kind: "openProjectRepository" })}>
                        <div>{i18n.t("menu.repository")}</div>
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
                        <div>{i18n.t("menu.about")}</div>
                    </Menubar.Item>
                </Menubar.Content>
            </Menubar.Portal>
        </Menubar.Menu>
    </Menubar.Root>
    <ProjectStatus />
</header>


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
        padding: 0 16px;
        border-radius: 8px;
        font-size: 15px;
    }
    :global([data-menu-content]) {
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
    @container (max-width: 400px) {
        :global(.menu-trigger) {
            padding: 0 4px;
        }
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { transcriptionLabel } from "../feedback";
    import { IsUsingKeyboard, Menubar } from "bits-ui";
    import ProjectStatus from "./ProjectStatus.svelte";
    import { commandDisabled, runCommand, interfaceBlocked, type Command } from "../../states/commands";
    import { type EditAction } from "../../../shared/app";
    import * as transcription from "../../states/transcription.svelte";
    import * as player from "../../states/player.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";

    const selectedMediaId = $derived(mediaSelection.get());
    const selectedTask = $derived(selectedMediaId ? transcription.getTask(selectedMediaId) : null);
    const transcriptionCommand = $derived<Command>({
        kind: selectedTask?.status === "failed" ? "reviewTranscriptionError" : selectedTask ? "stopTranscription" : "openTranscriptionConfig",
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

    const keyboard = new IsUsingKeyboard();
    let activeMenu = $state("");
    let fileContent = $state<HTMLDivElement | null>(null);
    let pendingAlt = false;
    let focusFileOnOpen = false;
    let editor: HTMLElement | null = null;
    let editorRange: Range | null = null;
    let editorSelection: { start: number; end: number; direction: "forward" | "backward" | "none" } | null = null;
    let restoringEditor = false;
    let focusingControl = false;
    let removalConfirmation = $state<string | null>(null);

    $effect(() => {
        if (activeMenu !== "media" || selectedMediaId !== removalConfirmation || interfaceBlocked()) removalConfirmation = null;
    });

    function rememberEditor(): void {
        if (activeMenu) return;
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
        activeMenu = "";
        restoreEditor();
        window.api.edit(action);
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
        focusingControl = activeMenu !== "" && (action.kind === "focusPlaybackSpeed" || action.kind === "focusPlaybackVolume");
        activeMenu = "";
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

    function handleFileShortcut(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.isComposing || event.altKey || event.getModifierState("AltGraph")) return;
        const command = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
        const key = event.key.toLowerCase();
        const editing = isEditingTarget(event.target);
        let action: Command | undefined;
        if (command) {
            if (event.shiftKey) {
                action = key === "s" ? { kind: "saveProjectAs" }
                    : key === "r" ? { kind: "focusPlaybackSpeed" }
                    : key === "e" ? { kind: "focusPlaybackVolume" } : undefined;
            }
            else action = key === "b" ? transcriptionCommand : shortcuts[key];
            if (!editing && (key === "arrowleft" || key === "arrowright")) {
                action = { kind: event.shiftKey ? "selectAdjacentMedia" : "seekAdjacentWord", direction: key === "arrowleft" ? -1 : 1 };
            }
        }
        else if (!editing && !event.ctrlKey && !event.metaKey && !event.shiftKey && key === " ") action = { kind: "playSelectedMedia" };
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) runFileAction(action);
    }

    function cancelAlt(): void {
        pendingAlt = false;
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
        pendingAlt = !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey
            && !event.isComposing && !event.getModifierState("AltGraph") && !menuBlocked();
    }

    function handleKeyup(event: KeyboardEvent): void {
        preventSpaceActivation(event);
        const toggle = pendingAlt && event.key === "Alt" && !event.defaultPrevented
            && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.isComposing
            && !event.getModifierState("AltGraph") && !menuBlocked();
        cancelAlt();
        if (!toggle) return;
        event.preventDefault();
        if (activeMenu) {
            activeMenu = "";
        }
        else {
            rememberEditor();
            focusFileOnOpen = true;
            activeMenu = "project";
        }
    }

    function handleFileOpenAutoFocus(event: Event): void {
        if (!focusFileOnOpen) return;
        focusFileOnOpen = false;
        const firstItem = fileContent?.querySelector<HTMLElement>("[data-menubar-item]:not([data-disabled])");
        if (!firstItem) return;
        event.preventDefault();
        firstItem.focus({ preventScroll: true });
    }

    function handleCloseAutoFocus(event: Event): void {
        // Switching menus or opening a dialog must keep focus in the new content.
        if (activeMenu || menuBlocked() || restoringEditor || focusingControl) {
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