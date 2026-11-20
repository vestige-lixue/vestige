<Tooltip text={commandLabel(command)} side="bottom" sideOffset={titleBarTooltipOffset} onclick={() => runCommand(command)}>
    {#snippet child({ props })}
        <button {...props} type="button" class="icon-button toggle focusable" class:hoverable={!disabled} class:activable={!disabled}
            class:enabled={pressed} class:disabled aria-pressed={pressed} aria-disabled={disabled}>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html columnsIcon}
        </button>
    {/snippet}
</Tooltip>


<style>
    button {
        -webkit-app-region: no-drag;
        box-sizing: border-box;
        width: 26px;
        height: 26px;
    }
    button.disabled { cursor: default; opacity: 0.5; }
</style>


<script lang="ts">
    import columnsIcon from "../../../resources/icons/lucide--columns-2.svg?raw";
    import { commandDisabled, commandLabel, runCommand } from "../../states/commands";
    import * as transcript from "../../states/transcript.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import { titleBarTooltipOffset } from "./titleBar";

    const command = { kind: "toggleReferenceTranscript" } as const;
    const disabled = $derived(commandDisabled(command));
    const pressed = $derived(!!transcript.getReference());
</script>