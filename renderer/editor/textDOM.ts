import { type EditorView } from "@tiptap/pm/view";
import { type TextWindow } from "../../shared/transcript/find";

/** One bounded DOM walk; hard breaks count once, read-only widgets and placeholders never count. */
export function walkTranscriptDOM(view: EditorView, window: TextWindow, visit: (node: Text | HTMLBRElement, from: number, to: number, group: number) => void): void {
    if (window.from >= window.to) return;
    const start = view.domAtPos(window.from + 1, 1);
    function after(node: Node): Node | null {
        while (node !== view.dom) {
            if (node.nextSibling) return node.nextSibling;
            if (!node.parentNode) return null;
            node = node.parentNode;
        }
        return null;
    }
    let node: Node | null = start.node.nodeType === Node.TEXT_NODE ? start.node : start.node.childNodes[start.offset] ?? after(start.node);
    let offset = window.from, group = 0;
    let textOffset = start.node.nodeType === Node.TEXT_NODE ? start.offset : 0;
    while (node && offset < window.to) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node as Text;
            const from = offset - textOffset;
            offset += text.length - textOffset;
            textOffset = 0;
            if (text.length) visit(text, from, offset, group);
        }
        else if (node instanceof HTMLElement) {
            if (node.contentEditable === "false") group++;
            else if (node instanceof HTMLBRElement) {
                if (!node.classList.contains("ProseMirror-trailingBreak")) {
                    visit(node, offset, offset + 1, group);
                    offset++;
                    group++;
                }
            }
            else if (node.firstChild) {
                node = node.firstChild;
                continue;
            }
        }
        node = after(node);
    }
}