<nav>
    <Tooltip text={i18n.t("transcription.vocabulary.title")} shortcut={shortcut({ kind: "openPanel", panel: "vocabulary" })} onclick={() => runCommand({ kind: "openPanel", panel: "vocabulary" })}>
        {#snippet child({ props })}
            <button {...props} class="icon-button hoverable activable focusable">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html bookIcon}
            </button>
        {/snippet}
    </Tooltip>
    <Tooltip text={i18n.t("transcription.tasks.title")} shortcut={shortcut({ kind: "openPanel", panel: "tasks" })} onclick={() => runCommand({ kind: "openPanel", panel: "tasks" })}>
        {#snippet child({ props })}
            <button {...props} class="icon-button hoverable activable focusable">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html taskBlankIcon}
                {#if taskCount > 0}
                    <span class="taskCount">{taskCount}</span>
                {/if}
            </button>
        {/snippet}
    </Tooltip>
    <Tooltip text={i18n.t("settings.title")} shortcut={shortcut({ kind: "openPanel", panel: "settings" })} onclick={() => runCommand({ kind: "openPanel", panel: "settings" })}>
        {#snippet child({ props })}
            <button {...props} class="icon-button hoverable activable focusable">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html settingsIcon}
            </button>
        {/snippet}
    </Tooltip>
</nav>


<style>
    nav {
        display: flex;
        flex-flow: row nowrap;
        justify-content: space-around;
        align-items: center;
        flex-shrink: 0;
        width: 100%;
        margin: 10px 0 8px;
    }
    nav button {
        position: relative;
        height: 24px;
        width: 24px;
        padding: 12px;
        border-radius: 24px;
    }
    .taskCount {
        position: absolute;
        top: 3px;
        right: 3px;
        display: grid;
        place-items: center;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 9px;
        background: var(--c-accent);
        color: var(--c-background);
        box-shadow: 0 0 0 2px var(--bg);
        font-size: 11px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        white-space: nowrap;
        pointer-events: none;
    }
</style>


<script lang="ts">
    import { shortcut } from "../../keybindings";
    import * as i18n from "../../i18n.svelte";
    import * as transcription from "../../states/transcription.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import { runCommand } from "../../states/commands";
    import bookIcon from "../../../resources/icons/carbon--book.svg?raw";
    import taskBlankIcon from "../../../resources/icons/carbon--task-blank.svg?raw";
    import settingsIcon from "../../../resources/icons/carbon--settings.svg?raw";

    const taskCount = $derived(transcription.tasks.filter(transcription.isPending).length);
</script>