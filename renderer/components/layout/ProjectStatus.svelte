{#if project.projectState.project}
    <div class="project-status">
        <div class="measurement">
            <div class="reserved-width" bind:borderBoxSize={null, sizes => reservedWidth = sizes?.[0]?.inlineSize ?? 0}>
                <span>{title}</span>
            </div>
        </div>
        <Tooltip
            text={project.projectState.path ?? i18n.t("project.unsaved.hint")}
            shortcut={project.projectState.path === null ? `${modKeyText}+S` : undefined}
            side="bottom"
            sideOffset={15}
            onclick={project.projectState.path === null ? () => runCommand({ kind: "saveProject" }) : undefined}
        >
            {#snippet child({ props })}
                {#if project.projectState.path === null}
                    <button {...props} class="focusable" type="button">
                        <NiceLabel
                            value={title}
                            editable={false}
                            onchange={() => {}}
                            scrollMode="ontime"
                            scrollParam={1.5}
                            scrollPause={0.5}
                        />
                    </button>
                {:else}
                    <NiceLabel
                        {...props}
                        tabindex={0}
                        value={title}
                        editable={false}
                        onchange={() => {}}
                        scrollMode="ontime"
                        scrollParam={1.5}
                        scrollPause={0.5}
                    />
                {/if}
            {/snippet}
        </Tooltip>
    </div>
{/if}


<style>
    .project-status {
        --status-gap: clamp(6px, calc(8cqw - 32px), 32px);
        flex: 0 1 auto;
        min-width: 0;
        margin-left: var(--status-gap);
        color: var(--c-text);
        font-size: 15px;
        text-align: left;
    }
    .project-status :global(*) {
        -webkit-app-region: no-drag;
    }
    .measurement {
        position: absolute;
        width: 0;
        height: 0;
        overflow: hidden;
        visibility: hidden;
        pointer-events: none;
    }
    .reserved-width {
        display: flex;
        width: max-content;
        padding-left: var(--status-gap);
    }
    .reserved-width span {
        max-width: 8em;
        overflow: hidden;
        white-space: nowrap;
    }
    button {
        display: block;
        width: 100%;
        color: inherit;
        text-align: inherit;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import * as project from "../../states/project.svelte";
    import { runCommand } from "../../states/commands";
    import NiceLabel from "../util/NiceLabel.svelte";
    import Tooltip from "../util/Tooltip.svelte";

    type Props = {
        reservedWidth?: number;
    };

    let { reservedWidth = $bindable(0) }: Props = $props();

    const title = $derived((project.getFileName() ?? i18n.t("project.unsaved.name")).replace(/\.vestige$/i, ""));
    const modKeyText = window.api.platform === "darwin" ? "⌘" : "Ctrl";

    $effect(() => {
        if (!project.projectState.project) reservedWidth = 0;
    });
</script>