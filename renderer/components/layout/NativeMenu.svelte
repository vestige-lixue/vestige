<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { type EditAction } from "../../../shared/app";
    import { type NativeMenu, type NativeMenuItem, type NativeMenuState } from "../../../shared/menu/NativeMenu";
    import { applicationActions, editActions, helpActions, menuGroups, menuItems, quitAction, type MenuAction } from "../../menuModel";
    import { commandShortcuts, editBinding } from "../../keybindings";
    import { editAvailable, onEditStateChanged, runEdit } from "../../edit";
    import { commandDisabled, commandLabel, interfaceBlocked, runCommand } from "../../states/commands";
    import * as i18n from "../../i18n.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as project from "../../states/project.svelte";
    import * as player from "../../states/player.svelte";
    import * as playerAPI from "../../states/player";
    import * as dialogsAPI from "../../states/dialogs";

    let availableEdits = $state<Record<EditAction, boolean>>({ undo: false, redo: false, cut: false, copy: false, paste: false, selectAll: false });
    let previousState = "";
    let pendingEditRefresh = false;
    let disposed = false;

    function editTarget(): HTMLElement | null {
        return document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    function canEdit(target: HTMLElement | null): boolean {
        return !interfaceBlocked() || !!target && (target.matches("input:not(:disabled), textarea:not(:disabled)") || target.isContentEditable);
    }

    function refreshEdits(): void {
        const target = editTarget();
        const allowed = canEdit(target);
        for (const action of editActions) {
            if (!action) continue;
            const enabled = allowed && editAvailable(target, action);
            if (availableEdits[action] !== enabled) availableEdits[action] = enabled;
        }
    }

    function scheduleEditRefresh(): void {
        if (pendingEditRefresh || disposed) return;
        pendingEditRefresh = true;
        queueMicrotask(() => {
            pendingEditRefresh = false;
            if (!disposed) refreshEdits();
        });
    }

    const model = $derived.by(() => {
        const actions: Record<string, MenuAction> = {};
        const blocked = interfaceBlocked();
        function items(group: string, entries: readonly (MenuAction | null)[]): NativeMenuItem[] {
            return entries.map((action, index): NativeMenuItem => {
                if (!action) return { type: "separator" };
                const id = `${group}:${index}`;
                actions[id] = action;
                if (action.kind === "edit") return {
                    type: "edit", id, label: i18n.t(`menu.edit.${action.action}`), enabled: availableEdits[action.action], shortcut: editBinding(action.action)
                };
                if (action.kind === "removeSelectedMedia") return {
                    type: "command", id, label: i18n.t("media.actions.remove"), enabled: !blocked && mediaSelection.get() !== null, shortcut: null
                };
                return {
                    type: "command", id, label: commandLabel(action),
                    // Word boundaries change every playback frame; execution still checks the exact position.
                    enabled: !blocked && (action.kind === "seekAdjacentWord" ? !!player.getURL() : !commandDisabled(action)),
                    shortcut: commandShortcuts(action)[0] ?? null
                };
            });
        }
        function system(role: Extract<NativeMenuItem, { type: "system" }>["role"]): NativeMenuItem {
            return { type: "system", role, label: i18n.t(`menu.system.${role}`) };
        }
        const menus: NativeMenu[] = [{
            label: "Vestige", items: [
                ...items("application", applicationActions), { type: "separator" }, system("services"), { type: "separator" },
                system("hide"), system("hideOthers"), system("unhide"), { type: "separator" },
                { type: "quit", label: commandLabel(quitAction), shortcut: commandShortcuts(quitAction)[0]! }
            ]
        }];
        for (const group of menuGroups) {
            if (group.value !== "misc") menus.push({ label: i18n.t(group.label), items: items(group.value, menuItems(group.value)) });
        }
        menus.push(
            { label: i18n.t("menu.window.title"), role: "window", items: [system("minimize"), system("zoom"), { type: "separator" }, system("front")] },
            { label: i18n.t("menu.help.title"), role: "help", items: items("help", helpActions) }
        );
        return { state: { menus } satisfies NativeMenuState, actions };
    });

    $effect(() => {
        const serialized = JSON.stringify(model.state);
        if (serialized === previousState) return;
        previousState = serialized;
        window.api.menu.update($state.snapshot(model.state));
    });
    $effect(() => {
        window.api.menu.setDocumentEdited(!!project.projectState.project && project.projectState.path === null);
    });
    $effect(() => {
        interfaceBlocked();
        mediaSelection.get();
        untrack(scheduleEditRefresh);
    });

    onMount(() => {
        const stopCommands = window.api.menu.onCommand(id => {
            const action = model.actions[id];
            if (!action) return;
            if (action.kind === "edit") {
                const target = editTarget();
                if (canEdit(target) && editAvailable(target, action.action)) runEdit(target, action.action);
                scheduleEditRefresh();
            }
            else if (action.kind === "removeSelectedMedia") {
                const mediaId = mediaSelection.get();
                if (interfaceBlocked() || mediaId === null) return;
                dialogsAPI.show({ kind: "remove-media", mediaId, onConfirm: () => {
                    if (mediaImport.getIds().includes(mediaId)) runCommand({ kind: "removeMedia", mediaId });
                } });
            }
            else runCommand(action);
        });
        const stopHidden = window.api.onHiddenByClose(() => playerAPI.setPlaying(false));
        const stopEdits = onEditStateChanged(scheduleEditRefresh);
        const events = ["selectionchange", "focusin", "focusout", "input"] as const;
        for (const event of events) document.addEventListener(event, scheduleEditRefresh);
        scheduleEditRefresh();
        return () => {
            disposed = true;
            stopCommands();
            stopHidden();
            stopEdits();
            for (const event of events) document.removeEventListener(event, scheduleEditRefresh);
        };
    });
</script>