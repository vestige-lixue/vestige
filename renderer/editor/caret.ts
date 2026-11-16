import { Plugin, TextSelection } from "@tiptap/pm/state";
import { isHistoryTransaction } from "@tiptap/pm/history";
import { compositionPending } from "./composition";
import { ProjectionStep } from "./projectionStep";

export function caretPlugin(): Plugin {
    return new Plugin({
        appendTransaction(transactions, oldState, newState) {
            if (!transactions.some(isHistoryTransaction)) return null;
            // A moved range follows the text back to its source on undo and to its destination on redo.
            if (transactions.some(transaction => transaction.steps.some(step => step instanceof ProjectionStep && step.restoreSelection))) return null;
            // Ordinary history edits keep the user's current selection.
            // Clamp to both text bounds so select-all excludes the paragraph boundaries.
            const end = Math.min(oldState.doc.content.size, newState.doc.content.size) - 1;
            const anchor = Math.max(1, Math.min(end, oldState.selection.anchor));
            const head = Math.max(1, Math.min(end, oldState.selection.head));
            const selection = TextSelection.create(newState.doc, anchor, head);
            return selection.eq(newState.selection) ? null : newState.tr.setSelection(selection);
        },
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
            let press: { x: number; y: number; head: number | null } | null = null;
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
                if (!dom?.isCollapsed || !dom.focusNode || !view.state.selection.empty || !view.dom.contains(dom.focusNode)) return hideCaret(false);
                // Before paint, the native caret may have moved while ProseMirror still has the old selection.
                const head = view.posAtDOM(dom.focusNode, dom.focusOffset);
                const pressed = press?.head === head;
                // ProseMirror can read selectionchange after us. Wait only for the first press's position to catch up.
                if (press && press.head !== null && (press.head !== head || head === view.state.selection.head)) press = null;
                let expanded: HTMLElement | undefined;
                if (head === view.state.selection.head) {
                    for (const widget of view.dom.querySelectorAll<HTMLElement>(".transcript-deletion-expanded")) {
                        if (view.posAtDOM(widget, 0) === head) expanded = widget;
                    }
                    if (expanded) {
                        if (dragging && !pressed) return hideCaret(false);
                        const boundary = document.createRange();
                        boundary.selectNode(expanded);
                        if (dom.getRangeAt(0).compareBoundaryPoints(Range.START_TO_START, boundary) <= 0) {
                            // TSF fixes its text offset before compositionstart; never start left of a read-only island.
                            boundary.setStartAfter(expanded);
                            const walker = document.createTreeWalker(view.dom, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
                                acceptNode: node => node.nodeType === Node.TEXT_NODE || node instanceof HTMLElement && (node.contentEditable === "false" || node.nodeName === "BR" || node.nodeName === "IMG")
                                    ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
                            });
                            walker.currentNode = expanded;
                            for (let next = walker.nextSibling(); next; next = walker.nextSibling()) {
                                if (next.nodeType === Node.TEXT_NODE) {
                                    boundary.setStart(next, 0);
                                    break;
                                }
                                if (!(next instanceof HTMLElement) || next.contentEditable !== "false") break;
                                boundary.setStartAfter(next);
                            }
                            if (view.posAtDOM(boundary.startContainer, boundary.startOffset) === head) dom.collapse(boundary.startContainer, boundary.startOffset);
                            return hideCaret(false);
                        }
                    }
                }
                if (dom.focusNode.nodeType === Node.TEXT_NODE) return hideCaret(false);
                const end = view.state.doc.content.size - 1;
                if (head !== 1 && head !== end) return hideCaret(false);
                let target = view.domAtPos(head, head === 1 ? 1 : -1);
                if (expanded && head === end || target.node.nodeType !== Node.TEXT_NODE) {
                    // Use the input anchor after trailing widgets, never text across a hard break or expanded deletion.
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
                press = null;
                schedule();
            }

            // selectionchange also covers native moves that dispatch no transaction.
            document.addEventListener("selectionchange", () => {
                if (press && press.head === null) {
                    const dom = document.getSelection();
                    if (dom?.isCollapsed && dom.focusNode && view.dom.contains(dom.focusNode)) press.head = view.posAtDOM(dom.focusNode, dom.focusOffset);
                    else press = null;
                }
                schedule();
            }, normal);
            // Schedule before native input: selectionchange itself may arrive after the first paint.
            for (const event of ["keydown", "focus"] as const) view.dom.addEventListener(event, beforePaint, capture);
            view.dom.addEventListener("pointerdown", event => {
                press = null;
                if (event.isPrimary && event.button === 0) dragging = true;
                beforePaint();
            }, capture);
            // Only mousedown carries the native click count. Consume this chance after Blink places the caret.
            view.dom.addEventListener("mousedown", event => {
                if (dragging && event.button === 0 && event.detail === 1 && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey
                    && !(event.target instanceof Element && event.target.closest(".transcript-deletion-expanded"))) press = { x: event.clientX, y: event.clientY, head: null };
            }, capture);
            document.addEventListener("pointermove", event => {
                if (!dragging) return;
                if (press && (press.x !== event.clientX || press.y !== event.clientY)) press = null;
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