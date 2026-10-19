<nav>
    <Tooltip text={i18n.t("transcription.vocabulary.title")} shortcut={`${modKeyText}+L`} onclick={() => runCommand({ kind: "openPanel", panel: "vocabulary" })}>
        {#snippet child({ props })}
            <button {...props} class="icon-button hoverable activable focusable">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html bookIcon}
            </button>
        {/snippet}
    </Tooltip>
    <Tooltip text={i18n.t("transcription.tasks.title")} shortcut={`${modKeyText}+T`} onclick={() => runCommand({ kind: "openPanel", panel: "tasks" })}>
        {#snippet child({ props })}
            <button {...props} class="icon-button hoverable activable focusable">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html taskBlankIcon}
            </button>
        {/snippet}
    </Tooltip>
    <Tooltip text={i18n.t("settings.title")} shortcut={`${modKeyText}+,`} onclick={() => runCommand({ kind: "openPanel", panel: "settings" })}>
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
        height: 24px;
        width: 24px;
        padding: 12px;
        border-radius: 24px;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import { runCommand } from "../../states/commands";
    import bookIcon from "../../../resources/icons/carbon--book.svg?raw";
    import taskBlankIcon from "../../../resources/icons/carbon--task-blank.svg?raw";
    import settingsIcon from "../../../resources/icons/carbon--settings.svg?raw";

    const modKeyText = window.api.platform === "darwin" ? "⌘" : "Ctrl";
</script>