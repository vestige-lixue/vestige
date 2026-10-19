<Modal bind:open bind:scrollElement width="880px" height="85%" escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <div class="heading">
        <Dialog.Title class="modal-title">{page.title}</Dialog.Title>
        {#if history.length}
            <button type="button" class="back link-button focusable" onclick={() => void back()}>{i18n.t("documentation.back")}</button>
        {/if}
    </div>
    {#if loading}
        <div>{i18n.t("documentation.loading")}</div>
    {:else if page.failure}
        <div class="error-message">{page.failure}</div>
    {:else if page.document}
        <Document document={page.document} {toc} bind:this={viewer} onnavigate={(href, anchor) => void navigate(href, anchor)} />
    {/if}
</Modal>


<style>
    .heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        overflow-wrap: anywhere;
    }
    .back {
        flex-shrink: 0;
    }
    .error-message {
        user-select: text;
    }
</style>


<script lang="ts">
    import { onDestroy, tick, untrack } from "svelte";
    import { Dialog } from "bits-ui";
    import { type Documentation, type DocumentationKind } from "../../../shared/documentation";
    import { toFailureInfo } from "../../../shared/failure";
    import { type Locale } from "../../../shared/locale";
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../../failures";
    import Modal from "../util/Modal.svelte";
    import Document from "../util/Document.svelte";

    type Props = { open: boolean; kind: DocumentationKind; toc?: boolean; onClosed: () => void };
    type Page = { document: Documentation | null; title: string; failure: string; scroll: number };
    let { open = $bindable(), kind, toc = false, onClosed }: Props = $props();
    let page = $state<Page>({ document: null, title: "", failure: "", scroll: 0 });
    let history = $state<Page[]>([]);
    let loading = $state(true);
    let scrollElement = $state<HTMLDivElement | null>(null);
    let viewer = $state<Document>();
    let generation = 0;

    $effect(() => {
        const documentKind = kind;
        const language = i18n.getLocale();
        untrack(() => void loadRoot(documentKind, language));
    });
    onDestroy(() => generation++);

    async function loadRoot(documentKind: DocumentationKind, language: Locale): Promise<void> {
        history = [];
        await load(() => window.api.documentation.read(documentKind, language), i18n.t(documentKind === "guide" ? "guide.title" : "transcription.parameters.guide.title"));
    }

    async function navigate(href: string, anchor: string): Promise<void> {
        if (!page.document || loading) return;
        const from = page.document.path;
        history.push({ ...page, scroll: scrollElement?.scrollTop ?? 0 });
        await load(() => window.api.documentation.readLink(from, href), href, anchor);
    }

    async function load(read: () => Promise<Documentation>, title: string, anchor = ""): Promise<void> {
        const current = ++generation;
        page = { document: null, title, failure: "", scroll: 0 };
        loading = true;
        try {
            const document = await read();
            if (current !== generation) return;
            page.document = document;
            page.title = documentTitle(document.path);
            loading = false;
            await tick();
            if (current !== generation) return;
            scrollElement?.scrollTo({ top: 0, behavior: "instant" });
            if (anchor) viewer?.scrollToAnchor(anchor);
        }
        catch (error) {
            if (current === generation) page.failure = describeFailure(toFailureInfo(error));
        }
        finally {
            if (current === generation) loading = false;
        }
    }

    async function back(): Promise<void> {
        const previous = history.pop();
        if (!previous) return;
        const current = ++generation;
        page = previous;
        loading = false;
        await tick();
        if (current === generation) scrollElement?.scrollTo({ top: page.scroll, behavior: "instant" });
    }

    function documentTitle(path: string): string {
        const name = path.split(/[\\/]/).at(-1) || path;
        if (/^README\.(en|zh-cn)\.md$/i.test(name)) return i18n.t("guide.title");
        if (/^params\.(en|zh-cn)\.md$/i.test(name)) return i18n.t("transcription.parameters.guide.title");
        return name;
    }
</script>