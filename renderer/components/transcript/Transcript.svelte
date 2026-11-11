<section class="transcript">
    {#if run && vestige}
        {#if settings.getEditing().informationDisplay === "bar"}
            <div class="information-bar">
                <TranscriptInformation {information} duration={vestige.media.duration} compact />
            </div>
        {/if}
        <div class="transcript-scroll" use:scrollWithControl>
            <TranscriptEditor {vestige} {run} onInspect={value => information = value} />
        </div>
    {:else}
        <div class="placeholder">{mediaSelection.get() ? i18n.t("transcript.emptyMedia") : i18n.t("transcript.empty")}</div>
    {/if}
</section>


<style>
    .transcript {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        overflow-wrap: anywhere;
        font-size: 16px;
        line-height: 1.8;
    }
    .information-bar {
        flex-shrink: 0;
        padding: 10px 28px;
        border-bottom: 1px solid var(--c-border);
        background: var(--c-surface);
    }
    .transcript-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }
    .placeholder {
        margin: 24px;
        color: var(--c-text-80p);
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import TranscriptEditor from "./TranscriptEditor.svelte";
    import TranscriptInformation from "./TranscriptInformation.svelte";
    import { type InspectionInformation } from "../../editor/information";
    import * as project from "../../states/project.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as transcript from "../../states/transcript.svelte";
    import * as settings from "../../states/settings.svelte";

    let information = $state.raw<InspectionInformation | null>(null);
    const run = $derived(transcript.getRun());
    const vestige = $derived(project.getVestige(mediaSelection.get()));

    function scrollWithControl(element: HTMLElement): { destroy: () => void } {
        function wheel(event: WheelEvent): void {
            if (!event.ctrlKey || event.defaultPrevented) return;
            // Ctrl-wheel normally zooms the page instead of scrolling the editor.
            event.preventDefault();
            const line = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? parseFloat(getComputedStyle(element).lineHeight) || 16 : 1;
            const page = event.deltaMode === WheelEvent.DOM_DELTA_PAGE;
            element.scrollBy({
                left: event.deltaX * (page ? element.clientWidth : line),
                top: event.deltaY * (page ? element.clientHeight : line),
                behavior: "instant"
            });
        }
        element.addEventListener("wheel", wheel, { passive: false });
        return { destroy: () => element.removeEventListener("wheel", wheel) };
    }
</script>