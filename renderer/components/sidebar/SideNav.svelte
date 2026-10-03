<nav>
    <Tooltip text="词库" onclick={() => openPanel("vocabulary")}>
        {#snippet child({ props })}
            <button {...props} class="hoverable activable">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html bookIcon}
            </button>
        {/snippet}
    </Tooltip>
    <Tooltip text="转写任务" onclick={() => openPanel("tasks")}>
        {#snippet child({ props })}
            <button {...props} class="hoverable activable">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html taskBlankIcon}
            </button>
        {/snippet}
    </Tooltip>
    <Tooltip text="设置" onclick={() => openPanel("settings")}>
        {#snippet child({ props })}
            <button {...props} class="hoverable activable">
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
        margin-bottom: 8px;
    }
    nav button {
        display: grid;
        place-items: center;
        height: 24px;
        width: 24px;
        padding: 12px;
        border-radius: 24px;
    }
    nav button :global(svg) {
        display: block;
        height: 100%;
        width: 100%;
        pointer-events: none;
    }
</style>


<script lang="ts">
    import Tooltip from "../util/Tooltip.svelte";
    import { openPanel } from "../../states/commands";
    import bookIcon from "../../../resources/icons/carbon--book.svg?raw";
    import taskBlankIcon from "../../../resources/icons/carbon--task-blank.svg?raw";
    import settingsIcon from "../../../resources/icons/carbon--settings.svg?raw";
</script>