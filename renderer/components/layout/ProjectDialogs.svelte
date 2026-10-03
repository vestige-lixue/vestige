{#if saveConfirmation.fileName !== null}
    {#if saveConfirmation.error === null}
        <SaveConfirmation />
    {:else}
        <SaveFailure />
    {/if}
{/if}
{#each mediaImports.importFailures as failure (failure)}
    <MediaImportError {failure} />
{/each}
{#each mediaImports.issue ? [mediaImports.issue] : [] as issue (issue)}
    <MediaIssues {issue} />
{/each}
<ProjectBusy />
{#if projectState.error !== null}
    <ProjectError message={projectState.error} onClosed={() => projectState.error = null} />
{/if}


<script lang="ts">
    import SaveConfirmation from "../dialogs/SaveConfirmation.svelte";
    import SaveFailure from "../dialogs/SaveFailure.svelte";
    import MediaImportError from "../dialogs/MediaImportError.svelte";
    import MediaIssues from "../dialogs/MediaIssues.svelte";
    import ProjectBusy from "../dialogs/ProjectBusy.svelte";
    import ProjectError from "../dialogs/ProjectError.svelte";
    import { mediaImports } from "../../states/media.svelte";
    import { projectState } from "../../states/project.svelte";
    import { saveConfirmation } from "../../states/confirmation.svelte";
</script>