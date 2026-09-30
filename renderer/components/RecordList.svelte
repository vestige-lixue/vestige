<section class="record-list">
    {#if projectState.project}
        <div class="project-status">{getProjectFileName()}{projectState.saving ? " · 保存中" : ""}</div>
        {#each projectState.project.vestiges as vestige (vestige)}
            <div class="record">
                <input bind:value={vestige.media.name} title="媒体名称" disabled={projectState.locked} />
                <span>{vestige.media.kind} · {Math.round(vestige.media.duration)}s</span>
            </div>
        {/each}
    {/if}
</section>

<style>
    .record-list {
        align-self: stretch;
        min-height: 0;
        padding: 12px;
        overflow-y: auto;
    }
    .project-status {
        color: var(--c-muted);
        font-size: 12px;
        margin-bottom: 8px;
    }
    span {
        color: var(--c-muted);
        font-size: 12px;
    }
    .record {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 0;
    }
    input {
        width: 100%;
        min-width: 0;
        color: inherit;
        background: transparent;
    }
</style>

<script lang="ts">
    import { getProjectFileName, projectState } from "../states/project.svelte";
</script>