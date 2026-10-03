<svelte:head>
    <title>{projectState.project ? `${getProjectFileName()} - ` : ""}Vestige</title>
</svelte:head>

<Tooltip.Provider delayDuration={300}>
    <FileDropOverlay locked={projectState.locked} />
    <ProjectDialogs />
    <ApplicationDialogs />
    <Sidebar />
    <div>
        <Menu />
        <main>
            <Player />
            <Transcript />
        </main>
    </div>
</Tooltip.Provider>


<style>
    div, main {
        display: flex;
        flex-flow: column nowrap;
    }
    main {
        flex: 1;
        min-height: 0;
        overflow: clip;
    }
</style>


<script lang="ts">
    import { onMount } from "svelte";
    import { Tooltip } from "bits-ui";
    import Menu from "./Menu.svelte";
    import Player from "../player/Player.svelte";
    import Sidebar from "../sidebar/Sidebar.svelte";
    import FileDropOverlay from "./FileDropOverlay.svelte";
    import ProjectDialogs from "./ProjectDialogs.svelte";
    import ApplicationDialogs from "./ApplicationDialogs.svelte";
    import Transcript from "../transcript/Transcript.svelte";
    import { getProjectFileName, projectState, startProjectLifecycle } from "../../states/project.svelte";

    onMount(startProjectLifecycle);
</script>