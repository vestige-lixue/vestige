<Modal bind:open width="760px" escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("licenses.title")}</Dialog.Title>
    <table class="licenses">
        <thead>
            <tr>
                <th scope="col">{i18n.t("licenses.project")}</th>
                <th scope="col">{i18n.t("licenses.license")}</th>
                <th scope="col">{i18n.t("licenses.url")}</th>
            </tr>
        </thead>
        <tbody>
            {#each projects as project (project.name)}
                <tr>
                    <td>{project.name}</td>
                    <td>{project.license}</td>
                    <td><a class="focusable" href={project.url} target="_blank">{project.url}</a></td>
                </tr>
            {/each}
        </tbody>
    </table>
    <div class="license-note">{i18n.t("licenses.ffmpegNote")}</div>
</Modal>


<style>
    .licenses {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        line-height: 1.6;
    }
    .licenses tbody * {
        user-select: text;
    }
    .licenses th, .licenses td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--c-border);
        vertical-align: top;
    }
    .licenses th {
        color: var(--c-text-80p);
        font-weight: 600;
        white-space: nowrap;
    }
    .licenses th:first-child, .licenses td:first-child {
        padding-left: 0;
    }
    .licenses th:last-child, .licenses td:last-child {
        padding-right: 0;
    }
    .licenses tr:last-child td {
        border-bottom: none;
    }
    .licenses a {
        overflow-wrap: anywhere;
    }
    .license-note {
        color: var(--c-text-80p);
        line-height: 1.6;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";

    let { open = $bindable(), onClosed }: { open: boolean; onClosed: () => void } = $props();

    const projects = [
        { name: "Electron", license: "MIT", url: "https://github.com/electron/electron" },
        { name: "Svelte", license: "MIT", url: "https://github.com/sveltejs/svelte" },
        { name: "Bits UI", license: "MIT", url: "https://github.com/huntabyte/bits-ui" },
        { name: "i18next", license: "MIT", url: "https://github.com/i18next/i18next" },
        { name: "typia", license: "MIT", url: "https://github.com/samchon/typia" },
        { name: "FFmpeg / ffprobe", license: "LGPL / GPL", url: "https://ffmpeg.org/" },
        { name: "sherpa-onnx", license: "Apache-2.0", url: "https://github.com/k2-fsa/sherpa-onnx" },
        { name: "whisper.cpp", license: "MIT", url: "https://github.com/ggml-org/whisper.cpp" },
        { name: "GGML", license: "MIT", url: "https://github.com/ggml-org/ggml" },
        { name: "Carbon Icons", license: "Apache-2.0", url: "https://github.com/carbon-design-system/carbon" }
    ];
</script>