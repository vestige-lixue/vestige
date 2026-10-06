{#if project.projectState.project}
    <div class="project-status">
        <Tooltip
            text={project.projectState.path ?? i18n.t("project.unsavedHint")}
            shortcut={project.projectState.path === null ? `${modKeyText}+S` : undefined}
            side="bottom"
            onclick={project.projectState.path === null ? () => runCommand({ kind: "saveProject" }) : undefined}
        >
            {#snippet child({ props })}
                {#if project.projectState.path === null}
                    <button {...props} class="focusable" type="button">
                        <NiceLabel
                            value={(project.getFileName() ?? i18n.t("common.unsaved")).replace(/\.vestige$/i, "")}
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
                        value={(project.getFileName() ?? i18n.t("common.unsaved")).replace(/\.vestige$/i, "")}
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
        -webkit-app-region: no-drag;
        flex: 0 1 auto;
        min-width: 0;
        max-width: min(28vw, 260px);
        margin-left: clamp(6px, calc(8cqw - 32px), 32px);
        color: var(--c-text);
        font-size: 15px;
        text-align: left;
    }
    button {
        display: block;
        width: 100%;
        font: inherit;
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

    const modKeyText = window.api.platform === "darwin" ? "⌘" : "Ctrl";
</script>