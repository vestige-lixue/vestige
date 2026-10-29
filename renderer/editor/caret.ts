import { Plugin } from "@tiptap/pm/state";
import { compositionPending } from "./composition";

export function caretPlugin(): Plugin {
    return new Plugin({
        props: {
            attributes(state) {
                const last = state.doc.firstChild?.lastChild;
                return { class: !last || last.type.name === "hardBreak" ? "transcript-trailing-empty" : "" };
            }
        },
        view(view) {
            const document = view.dom.ownerDocument;
            const window = document.defaultView!;
            const listeners = new AbortController();
            const normal = { signal: listeners.signal };
            const capture = { ...normal, capture: true };
            let queued = false;
            let frame = 0;
            let dragging = false;
            let destroyed = false;
            let hidden = false;
            let color = "";
            let priority = "";

            function hideCaret(value: boolean): void {
                if (hidden === value) return;
                hidden = value;
                if (value) {
                    color = view.dom.style.getPropertyValue("caret-color");
                    priority = view.dom.style.getPropertyPriority("caret-color");
                    view.dom.style.setProperty("caret-color", "transparent", "important");
                }
                else if (color) view.dom.style.setProperty("caret-color", color, priority);
                else view.dom.style.removeProperty("caret-color");
            }

            function normalize(): void {
                queued = false;
                if (destroyed || view.isDestroyed) return;
                if (!view.hasFocus() || view.composing || compositionPending(view.state)) return hideCaret(false);
                const dom = document.getSelection();
                if (!dom?.isCollapsed || !dom.focusNode || dom.focusNode.nodeType === Node.TEXT_NODE || !view.dom.contains(dom.focusNode)) return hideCaret(false);
                // Before paint, the native caret may have moved while ProseMirror still has the old selection.
                const head = view.posAtDOM(dom.focusNode, dom.focusOffset);
                const end = view.state.doc.content.size - 1;
                if (head !== 1 && head !== end) return hideCaret(false);
                let target = view.domAtPos(head, head === 1 ? 1 : -1);
                if (target.node.nodeType !== Node.TEXT_NODE) {
                    // A trailing blank line uses the input anchor after its widgets, never text across a hard break.
                    const paragraph = view.dom.firstElementChild;
                    const separator = paragraph?.lastElementChild?.previousSibling;
                    if (head !== end || !(separator instanceof HTMLImageElement) || !separator.classList.contains("ProseMirror-separator")) return hideCaret(false);
                    target = { node: paragraph!, offset: paragraph!.childNodes.length - 2 };
                }
                if (dom.focusNode === target.node && dom.focusOffset === target.offset) return hideCaret(false);
                // Changing the DOM selection while pressed resets Chromium's native drag anchor.
                if (dragging) return hideCaret(true);
                dom.collapse(target.node, target.offset);
                hideCaret(false);
            }

            function schedule(): void {
                if (queued || destroyed) return;
                queued = true;
                queueMicrotask(normalize);
            }

            function beforePaint(): void {
                if (frame || destroyed) return;
                frame = window.requestAnimationFrame(() => {
                    frame = 0;
                    normalize();
                });
            }

            function release(): void {
                dragging = false;
                schedule();
            }

            // selectionchange also covers native moves that dispatch no transaction.
            document.addEventListener("selectionchange", schedule, normal);
            // Schedule before native input: selectionchange itself may arrive after the first paint.
            for (const event of ["keydown", "focus"] as const) view.dom.addEventListener(event, beforePaint, capture);
            view.dom.addEventListener("pointerdown", event => {
                if (event.isPrimary && event.button === 0) dragging = true;
                beforePaint();
            }, capture);
            view.dom.addEventListener("pointermove", event => {
                if (!dragging) return;
                if (event.buttons === 0) release();
                else beforePaint();
            }, capture);
            view.dom.addEventListener("blur", release, normal);
            document.addEventListener("pointerup", release, capture);
            document.addEventListener("pointercancel", release, capture);
            window.addEventListener("blur", release, normal);
            schedule();
            return {
                update: schedule,
                destroy() {
                    destroyed = true;
                    window.cancelAnimationFrame(frame);
                    listeners.abort();
                    hideCaret(false);
                }
            };
        }
    });
}