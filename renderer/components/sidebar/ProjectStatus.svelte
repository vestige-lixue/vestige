<div class="project-status">
    <div class="project-name">
        <NiceLabel
            value={getProjectFileName()}
            editable={false}
            onchange={() => {}}
            scrollMode="ontime"
            scrollParam={1.5}
            scrollPause={0.5}
        />
        {#if projectState.project}
            <Tooltip text="关闭项目" side="bottom" onclick={closeProject}>
                {#snippet child({ props })}
                    <button {...props} class="hoverable activable">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html closeIcon}
                    </button>
                {/snippet}
            </Tooltip>
        {/if}
    </div>
</div>


<style>
    .project-status {
        display: flex;
        width: 100%;
        flex-flow: column nowrap;
        justify-content: center;
        gap: 8px;
        align-items: center;
        color: var(--c-text);
        font-size: 16px;
        margin: 16px 0;
    }
    .project-name {
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        text-align: center;
        width: 90%;
        gap: 8px;
    }
    button {
        display: grid;
        place-items: center;
        height: 18px;
        width: 18px;
        flex-shrink: 0;
        padding: 4px;
        border-radius: 8px;
    }
</style>


<script lang="ts">
    import closeIcon from "../../../resources/icons/carbon--close.svg?raw";
    import { closeProject, getProjectFileName, projectState } from "../../states/project.svelte";
    import NiceLabel from "../util/NiceLabel.svelte";
    import Tooltip from "../util/Tooltip.svelte";
</script>