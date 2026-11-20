<div class="runDetails">
    <div><b>{i18n.t("transcription.config.executor.label")}</b><span>{run.config.executor}</span></div>
    <div><b>{i18n.t("transcription.config.backendDirectory.label")}</b><span>{displayDirectoryName(run.config.backendDirectory)}</span></div>
    <div><b>{i18n.t("transcription.config.modelDirectory.label")}</b><span>{displayDirectoryName(run.config.modelDirectory)}</span></div>
</div>

<style>
    .runDetails {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .runDetails > div {
        display: flex;
        justify-content: space-between;
        gap: 16px;
    }
    .runDetails b { flex-shrink: 0; }
    .runDetails span { min-width: 0; text-align: right; }
</style>

<script lang="ts">
    import { type Run } from "../../../shared/transcription/Run";
    import * as i18n from "../../i18n.svelte";

    let { run }: { run: Run } = $props();

    function displayDirectoryName(path: string): string {
        const parts = path.split(path.startsWith("/") ? /\// : /[\\/]/).filter(Boolean);
        return parts.at(-1) ?? path;
    }
</script>