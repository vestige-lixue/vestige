import { Plugin } from "@tiptap/pm/state";
import { transcriptDropPosition, type DropPointer } from "./drop";
import { attachDropScroll } from "./dropScroll";

export function dropCursorPlugin(): Plugin {
    return new Plugin({
        view(view) {
            let pointer: DropPointer | undefined;
            let moving = false;
            let element: HTMLElement | undefined;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const scrolling = attachDropScroll(view, () => {
                if (pointer) refresh(pointer);
            });

            function removeCursor(): void {
                element?.remove();
                element = undefined;
            }

            function refresh(point: DropPointer): void {
                const target = transcriptDropPosition(view, point);
                const { from, to } = view.state.selection;
                // Keep both selection edges available, hiding only the interior of an internal drag.
                if (!view.editable || target === null || moving && target > from && target < to) return removeCursor();
                const parent = view.dom.offsetParent as HTMLElement | null;
                if (!parent) return removeCursor();
                const rect = view.coordsAtPos(target);
                // At EOF, coordsAtPos can measure the marker widget instead of the text line.
                const trailing = target === view.state.doc.content.size - 1
                    ? view.dom.querySelector<HTMLElement>("br.ProseMirror-trailingBreak")?.getBoundingClientRect() : undefined;
                const origin = parent.getBoundingClientRect();
                const scaleX = origin.width / parent.offsetWidth || 1, scaleY = origin.height / parent.offsetHeight || 1;
                if (!element) {
                    element = parent.appendChild(view.dom.ownerDocument.createElement("div"));
                    element.className = "transcript-dropcursor prosemirror-dropcursor-inline";
                    element.style.cssText = "position: absolute; z-index: 50; pointer-events: none; width: 2px; background-color: var(--c-accent);";
                }
                element.style.left = `${(rect.left - origin.left) / scaleX + parent.scrollLeft - parent.clientLeft - 1}px`;
                element.style.top = `${((trailing?.top ?? rect.top) - origin.top) / scaleY + parent.scrollTop - parent.clientTop}px`;
                element.style.height = `${((trailing?.bottom ?? rect.bottom) - (trailing?.top ?? rect.top)) / scaleY}px`;
            }

            function dragover(event: DragEvent): void {
                if (!view.editable || event.dataTransfer?.types.includes("Files")) return clearPointer();
                let copy: boolean | undefined;
                view.someProp("dragCopies", test => copy = copy || test(event));
                const mac = /Mac/.test(view.dom.ownerDocument.defaultView!.navigator.platform);
                moving = !!view.dragging && !(copy ?? (mac ? event.altKey : event.ctrlKey));
                pointer = { left: event.clientX, top: event.clientY };
                refresh(pointer);
                scrolling.update(pointer);
                clearTimeout(timer);
                timer = setTimeout(clearPointer, 5000);
            }

            function clearPointer(): void {
                pointer = undefined;
                scrolling.update();
                clearTimeout(timer);
                removeCursor();
            }

            const listeners = new AbortController();
            const options = { signal: listeners.signal };
            view.dom.addEventListener("dragover", dragover, options);
            view.dom.addEventListener("dragleave", event => {
                if (!(event.relatedTarget instanceof Node) || !view.dom.contains(event.relatedTarget)) clearPointer();
            }, options);
            view.dom.addEventListener("drop", clearPointer, options);
            view.dom.addEventListener("dragend", clearPointer, options);
            view.dom.ownerDocument.defaultView!.addEventListener("blur", clearPointer, options);
            view.dom.ownerDocument.addEventListener("dragend", clearPointer, options);
            view.dom.ownerDocument.addEventListener("drop", clearPointer, options);
            return {
                update() {
                    if (pointer) refresh(pointer);
                },
                destroy() {
                    listeners.abort();
                    clearPointer();
                    scrolling.destroy();
                }
            };
        }
    });
}