import { marked } from "marked";
import DOMPurify from "dompurify";
import { parseDocumentLink } from "../shared/documentation";

export type MarkdownHeading = { id: string; text: string; level: number };
export type RenderedMarkdown = { html: string; headings: MarkdownHeading[]; links: string[] };

export function renderMarkdown(source: string, prefix = ""): RenderedMarkdown {
    const fragment = DOMPurify.sanitize(marked.parse(source, { async: false }), {
        ALLOWED_TAGS: ["a", "blockquote", "br", "code", "del", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "li", "ol", "p", "pre", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul"],
        ALLOWED_ATTR: ["href", "start", "align"],
        ALLOW_ARIA_ATTR: false,
        ALLOW_DATA_ATTR: false,
        RETURN_DOM_FRAGMENT: true
    });
    const headings: MarkdownHeading[] = [];
    const ids = new Set<string>();
    for (const heading of fragment.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
        const text = heading.textContent ?? "";
        const base = text.normalize("NFC").toLowerCase().trim().replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, "").replace(/\s+/gu, "-") || "section";
        let id = base;
        let suffix = 0;
        while (ids.has(id)) id = `${base}-${++suffix}`;
        ids.add(id);
        heading.id = prefix + id;
        headings.push({ id, text, level: Number(heading.tagName.slice(1)) });
    }
    const links: string[] = [];
    for (const link of fragment.querySelectorAll("a")) {
        const href = link.getAttribute("href");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "document-link link-button focusable";
        if (href && parseDocumentLink(href)) button.value = String(links.push(href) - 1);
        else button.disabled = true;
        button.append(...link.childNodes);
        link.replaceWith(button);
    }
    const container = document.createElement("div");
    container.append(fragment);
    return { html: container.innerHTML, headings, links };
}