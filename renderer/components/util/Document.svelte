<div class="document">
    <div class="source">{i18n.t("documentation.path", { path: document.path })}</div>
    {#if toc && rendered.headings.length}
        <nav class="toc">
            <div class="toc-title">{i18n.t("documentation.contents")}</div>
            <ul>
                {#each rendered.headings as heading (heading.id)}
                    <li style:padding-left={`${(heading.level - firstLevel) * 16}px`}>
                        <button type="button" class="document-link link-button focusable" onclick={() => scrollToAnchor(heading.id)}>{heading.text}</button>
                    </li>
                {/each}
            </ul>
        </nav>
    {/if}
    <article bind:this={article}>
        <!-- Markdown is sanitized before generating headings and link buttons. -->
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html rendered.html}
    </article>
    {#if failure}<div class="error-message">{failure}</div>{/if}
</div>


<style>
    .document {
        line-height: 1.7;
        overflow-wrap: anywhere;
    }
    .document :global(*) {
        user-select: text;
    }
    .document :global(:not(h1, h2, h3, h4, h5, h6)) {
        line-height: inherit;
    }
    .source {
        margin-bottom: 24px;
        color: var(--c-text-80p);
        font-size: 15px;
    }
    .toc {
        margin-bottom: 24px;
    }
    .toc-title {
        font-size: 24px;
        font-weight: 600;
    }
    .toc ul {
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
    }
    .document :global(.document-link) {
        display: inline;
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: none;
    }
    .document :global(.document-link:disabled) {
        cursor: default;
    }
    article :global(h2) {
        margin: 24px 0 12px;
    }
    article :global(:is(h3, h4, h5, h6)) {
        margin: 16px 0 8px;
    }
    article :global(pre) {
        padding: 12px;
        overflow: auto;
        background: var(--c-surface);
        border: 1px solid var(--c-border);
        border-radius: 6px;
    }
    article :global(pre), article :global(code) {
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 13px;
    }
    article :global(table) {
        width: 100%;
        margin: 12px 0;
        border-collapse: collapse;
        text-align: left;
    }
    article :global(th), article :global(td) {
        padding: 8px;
        border-bottom: 1px solid var(--c-border);
        vertical-align: top;
        overflow-wrap: anywhere;
    }
    article :global(ul), article :global(ol) {
        padding-left: 24px;
    }
    article :global(li + li) {
        margin-top: 6px;
    }
    article :global(blockquote) {
        margin-left: 0;
        padding-left: 16px;
        border-left: 3px solid var(--c-border);
        color: var(--c-text-80p);
    }
</style>


<script lang="ts">
    import { onDestroy } from "svelte";
    import { type Documentation, parseDocumentLink } from "../../../shared/documentation";
    import { toFailureInfo } from "../../../shared/failure";
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../../failures";
    import { renderMarkdown } from "../../markdown";

    type Props = {
        document: Documentation;
        toc?: boolean;
        onnavigate: (href: string, anchor: string) => void;
    };
    let { document, toc = false, onnavigate }: Props = $props();
    const id = $props.id();
    const prefix = `${id}-`;
    let article: HTMLElement;
    let failure = $state("");
    let generation = 0;
    const rendered = $derived(renderMarkdown(document.content, prefix));
    const firstLevel = $derived(Math.min(...rendered.headings.map(heading => heading.level)));

    $effect(() => {
        // Invalidate outgoing URL requests when the document changes.
        void document;
        generation++;
        failure = "";
    });
    $effect(() => {
        const element = article;
        element.addEventListener("click", handleClick);
        return () => element.removeEventListener("click", handleClick);
    });
    onDestroy(() => generation++);

    export function scrollToAnchor(anchor: string): boolean {
        failure = "";
        if (!anchor) {
            article?.parentElement?.scrollIntoView({ block: "start", behavior: "instant" });
            return true;
        }
        const target = [...article.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")].find(heading => heading.id === prefix + anchor);
        target?.scrollIntoView({ block: "start", behavior: "instant" });
        if (!target) failure = i18n.t("documentation.missingAnchor", { anchor });
        return !!target;
    }

    function handleClick(event: MouseEvent): void {
        const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button.document-link") : null;
        if (!button || !article.contains(button) || button.disabled) return;
        event.preventDefault();
        const href = rendered.links[Number(button.value)];
        const link = href === undefined ? null : parseDocumentLink(href);
        if (!link) return;
        failure = "";
        if (link.kind === "local") {
            if (!link.path) scrollToAnchor(link.anchor);
            else onnavigate(href, link.anchor);
        }
        else {
            const current = ++generation;
            void window.api.documentation.openExternal(link.url).then(result => {
                if (current === generation && !result.success) failure = describeFailure(result.error);
            }).catch(error => {
                if (current === generation) failure = describeFailure(toFailureInfo(error));
            });
        }
    }
</script>