<svelte:window
    onkeydowncapture={handleKeydown}
    onkeyupcapture={handleKeyup}
    onpointerdowncapture={cancelAlt}
    onblur={cancelAlt}
/>

<Menubar.Root class="menu" bind:value={activeMenu} onpointerdowncapture={rememberEditor}>
    <Menubar.Menu value="project">
        <Menubar.Trigger class="menu-trigger hoverable activable">项目</Menubar.Trigger>
        <Menubar.Portal>
            <Menubar.Content bind:ref={fileContent} onOpenAutoFocus={handleFileOpenAutoFocus} align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                <Menubar.Item class="activable" disabled={fileActionDisabled({ kind: "newProject" })} onSelect={() => runFileAction({ kind: "newProject" })}>
                    <div>新建</div>
                    <kbd>{modKeyText}+N</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" disabled={fileActionDisabled({ kind: "openProject" })} onSelect={() => runFileAction({ kind: "openProject" })}>
                    <div>打开</div>
                    <kbd>{modKeyText}+O</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" disabled={fileActionDisabled({ kind: "saveProject" })} onSelect={() => runFileAction({ kind: "saveProject" })}>
                    <div>保存</div>
                    <kbd>{modKeyText}+S</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" disabled={fileActionDisabled({ kind: "saveProjectAs" })} onSelect={() => runFileAction({ kind: "saveProjectAs" })}>
                    <div>另存为</div>
                    <kbd>{modKeyText}+⇧+S</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" disabled={fileActionDisabled({ kind: "closeProject" })} onSelect={() => runFileAction({ kind: "closeProject" })}>
                    <div>关闭</div>
                    <kbd>{modKeyText}+W</kbd>
                </Menubar.Item>
            </Menubar.Content>
        </Menubar.Portal>
    </Menubar.Menu>
    <Menubar.Menu value="media">
        <Menubar.Trigger class="menu-trigger hoverable activable">媒体</Menubar.Trigger>
        <Menubar.Portal>
            <Menubar.Content align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                <Menubar.Item class="activable" disabled={commandDisabled({ kind: "importMedia" })} onSelect={() => runMenuCommand({ kind: "importMedia" })}>
                    <div>导入媒体</div>
                    <kbd>{modKeyText}+I</kbd>
                </Menubar.Item>
                <Menubar.Separator />
                <Menubar.Item class="activable" disabled={commandDisabled(transcriptionCommand)} onSelect={() => runMenuCommand(transcriptionCommand)}>
                    <div>{transcription.getLabel(mediaSelection.get())}</div>
                </Menubar.Item>
                <Menubar.Separator />
                <Menubar.Item class="activable" disabled={commandDisabled({ kind: "selectAdjacentMedia", direction: -1 })} onSelect={() => runMenuCommand({ kind: "selectAdjacentMedia", direction: -1 })}>
                    <div>上一媒体</div>
                    <kbd>{modKeyText}+⇧+←</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" disabled={commandDisabled({ kind: "selectAdjacentMedia", direction: 1 })} onSelect={() => runMenuCommand({ kind: "selectAdjacentMedia", direction: 1 })}>
                    <div>下一媒体</div>
                    <kbd>{modKeyText}+⇧+→</kbd>
                </Menubar.Item>
            </Menubar.Content>
        </Menubar.Portal>
    </Menubar.Menu>
    <Menubar.Menu value="edit">
        <Menubar.Trigger class="menu-trigger hoverable activable">编辑</Menubar.Trigger>
        <Menubar.Portal>
            <Menubar.Content align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                <Menubar.Item class="activable" onSelect={() => runEdit("undo")}>
                    <div>撤销</div>
                    <kbd>{modKeyText}+Z</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" onSelect={() => runEdit("redo")}>
                    <div>重做</div>
                    <kbd>{modKeyText}+Y</kbd>
                </Menubar.Item>
                <Menubar.Separator />
                <Menubar.Item class="activable" onSelect={() => runEdit("cut")}>
                    <div>剪切</div>
                    <kbd>{modKeyText}+X</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" onSelect={() => runEdit("copy")}>
                    <div>复制</div>
                    <kbd>{modKeyText}+C</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" onSelect={() => runEdit("paste")}>
                    <div>粘贴</div>
                    <kbd>{modKeyText}+V</kbd>
                </Menubar.Item>
                <Menubar.Separator />
                <Menubar.Item class="activable" disabled={commandDisabled({ kind: "openPanel", panel: "vocabulary" })} onSelect={() => runMenuCommand({ kind: "openPanel", panel: "vocabulary" })}>
                    <div>词库</div>
                    <kbd>{modKeyText}+L</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" disabled={commandDisabled({ kind: "openPanel", panel: "tasks" })} onSelect={() => runMenuCommand({ kind: "openPanel", panel: "tasks" })}>
                    <div>转写任务</div>
                    <kbd>{modKeyText}+T</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" disabled={commandDisabled({ kind: "openPanel", panel: "settings" })} onSelect={() => runMenuCommand({ kind: "openPanel", panel: "settings" })}>
                    <div>设置</div>
                    <kbd>{modKeyText}+,</kbd>
                </Menubar.Item>
            </Menubar.Content>
        </Menubar.Portal>
    </Menubar.Menu>
    <Menubar.Menu value="play">
        <Menubar.Trigger class="menu-trigger hoverable activable">播放</Menubar.Trigger>
        <Menubar.Portal>
            <Menubar.Content align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                <Menubar.Item class="activable" disabled={commandDisabled({ kind: "playSelectedMedia" })} onSelect={() => runMenuCommand({ kind: "playSelectedMedia" })}>
                    <div>{player.isPlaying() ? "暂停" : "播放"}</div>
                    <kbd>Space</kbd>
                </Menubar.Item>
                <Menubar.Separator />
                <Menubar.Item class="activable" disabled={commandDisabled({ kind: "seekAdjacentWord", direction: -1 })} onSelect={() => runMenuCommand({ kind: "seekAdjacentWord", direction: -1 })}>
                    <div>上一词</div>
                    <kbd>{modKeyText}+←</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" disabled={commandDisabled({ kind: "seekAdjacentWord", direction: 1 })} onSelect={() => runMenuCommand({ kind: "seekAdjacentWord", direction: 1 })}>
                    <div>下一词</div>
                    <kbd>{modKeyText}+→</kbd>
                </Menubar.Item>
            </Menubar.Content>
        </Menubar.Portal>
    </Menubar.Menu>
    <Menubar.Menu value="misc">
        <Menubar.Trigger class="menu-trigger hoverable activable">其他</Menubar.Trigger>
        <Menubar.Portal>
            <Menubar.Content align="start" sideOffset={8} onCloseAutoFocus={handleCloseAutoFocus}>
                <Menubar.Item class="activable" disabled={commandDisabled({ kind: "openPanel", panel: "settings" })} onSelect={() => runMenuCommand({ kind: "openPanel", panel: "settings" })}>
                    <div>关于</div>
                </Menubar.Item>
                <Menubar.Item class="activable" onSelect={() => {
                    runCommand({ kind: "openDevTools" });
                }}>
                    <div>打开开发者工具</div>
                    <kbd>F12</kbd>
                </Menubar.Item>
                <Menubar.Item class="activable" disabled={fileActionDisabled({ kind: "quitApp" })} onSelect={() => runFileAction({ kind: "quitApp" })}>
                    <div>退出应用</div>
                    <kbd>{modKeyText}+Q</kbd>
                </Menubar.Item>
            </Menubar.Content>
        </Menubar.Portal>
    </Menubar.Menu>
</Menubar.Root>


<style>
    :global(.menu) {
        -webkit-app-region: drag;
        height: env(titlebar-area-height);
        margin-bottom: var(--drag-region-margin);
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        gap: 0;
        padding: 0 8px;
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
        background: var(--c-border);
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
    import { Menubar } from "bits-ui";
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
        l: { kind: "openPanel", panel: "vocabulary" },
        t: { kind: "openPanel", panel: "tasks" },
        ",": { kind: "openPanel", panel: "settings" }
    };

    let activeMenu = $state("");
    let fileContent = $state<HTMLDivElement | null>(null);
    let pendingAlt = false;
    let focusFileOnOpen = false;
    let editor: HTMLElement | null = null;
    let editorRange: Range | null = null;
    let editorSelection: { start: number; end: number; direction: "forward" | "backward" | "none" } | null = null;
    let restoringEditor = false;

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
        activeMenu = "";
        runCommand(action);
    }

    function handleFileShortcut(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.isComposing || event.altKey || event.getModifierState("AltGraph")) return;
        const command = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
        const key = event.key.toLowerCase();
        const editing = event.target instanceof HTMLElement && (event.target.closest("input, textarea") || event.target.isContentEditable);
        let action: Command | undefined;
        if (command) {
            action = event.shiftKey ? (key === "s" ? { kind: "saveProjectAs" } : undefined) : shortcuts[key];
            if (!editing && (key === "arrowleft" || key === "arrowright")) {
                action = { kind: event.shiftKey ? "selectAdjacentMedia" : "seekAdjacentWord", direction: key === "arrowleft" ? -1 : 1 };
            }
        }
        else if (!editing && !event.ctrlKey && !event.metaKey && !event.shiftKey && key === " " && !activeMenu) action = { kind: "playSelectedMedia" };
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) runFileAction(action);
    }

    function cancelAlt(): void {
        pendingAlt = false;
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (event.key !== "Alt") {
            cancelAlt();
            handleFileShortcut(event);
            return;
        }
        if (event.repeat) return;
        pendingAlt = !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey
            && !event.isComposing && !event.getModifierState("AltGraph") && !menuBlocked();
    }

    function handleKeyup(event: KeyboardEvent): void {
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
        if (activeMenu || menuBlocked() || restoringEditor) {
            event.preventDefault();
        }
        else if (editor?.isConnected) {
            event.preventDefault();
            restoreEditor();
        }
        restoringEditor = false;
    }
</script>