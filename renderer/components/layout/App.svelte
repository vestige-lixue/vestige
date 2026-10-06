<svelte:head>
    <title>{project.projectState.project ? `${(project.getFileName() ?? i18n.t("common.unsaved")).replace(/\.vestige$/i, "")} - ` : ""}Vestige</title>
</svelte:head>

<Tooltip.Provider delayDuration={300}>
    <FileDropOverlay locked={project.projectState.locked} />
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
    import * as i18n from "../../i18n.svelte";
    import { onMount } from "svelte";
    import { Tooltip } from "bits-ui";
    import Menu from "./Menu.svelte";
    import Player from "../player/Player.svelte";
    import Sidebar from "../sidebar/Sidebar.svelte";
    import FileDropOverlay from "./FileDropOverlay.svelte";
    import ApplicationDialogs from "./ApplicationDialogs.svelte";
    import Transcript from "../transcript/Transcript.svelte";
    import * as project from "../../states/project.svelte";
    import * as config from "../../states/config.svelte";
    import * as transcription from "../../states/transcription.svelte";
    import * as dialogs from "../../states/dialogs.svelte";

    $effect(() => {
        document.documentElement.lang = i18n.getLocale();
        document.documentElement.dir = "ltr";
    });

    onMount(() => {
        void config.initialize();
        const stopTranscription = transcription.startLifecycle();
        const stopProject = project.startLifecycle(async () => {
            if (await config.save()) return true;
            if (!dialogs.state.dialogs.some(dialog => dialog.kind === "settings" && dialog.open)) {
                dialogs.show({ kind: "settings", onClosed: () => {} });
            }
            return false;
        });
        return () => {
            stopTranscription();
            stopProject();
            config.dispose();
        };
    });
</script>