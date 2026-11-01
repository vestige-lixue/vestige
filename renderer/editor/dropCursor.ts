import { Plugin } from "@tiptap/pm/state";
import { dropCursor } from "@tiptap/pm/dropcursor";
import { dropPoint } from "@tiptap/pm/transform";

export function dropCursorPlugin(): Plugin {
    const cursor = dropCursor({ color: "var(--c-accent)", width: 2, class: "transcript-dropcursor" });
    return new Plugin({
        view(view) {
            const overlay = cursor.spec.view!(view);
            let pointer: { left: number; top: number } | undefined;

            function refresh(): void {
                const element = view.dom.offsetParent?.querySelector<HTMLElement>(".transcript-dropcursor");
                if (!element) return;
                const position = pointer && view.posAtCoords(pointer);
                const target = position && (view.dragging?.slice ? dropPoint(view.state.doc, position.pos, view.dragging.slice) : position.pos);
                const { from, to } = view.state.selection;
                // The transcript has one text block. Its outer boundaries cannot accept another block.
                // Keep both selection edges available, hiding only the interior of an internal drag.
                element.hidden = !view.editable || target == null || !view.state.doc.resolve(target).parent.inlineContent
                    || !!view.dragging && target > from && target < to;
                if (element.hidden || target !== view.state.doc.content.size - 1) return;
                // At EOF, coordsAtPos can measure the marker widget instead of the text line.
                const trailing = view.dom.querySelector<HTMLElement>("br.ProseMirror-trailingBreak");
                const parent = element.offsetParent as HTMLElement | null;
                if (trailing && parent) {
                    const rect = trailing.getBoundingClientRect();
                    const origin = parent.getBoundingClientRect();
                    const scale = origin.height / parent.offsetHeight;
                    element.style.top = `${(rect.top - origin.top) / scale + parent.scrollTop - parent.clientTop}px`;
                    element.style.height = `${rect.height / scale}px`;
                }
            }

            function dragover(event: DragEvent): void {
                pointer = { left: event.clientX, top: event.clientY };
                refresh();
            }

            // Run after the upstream listener has created or repositioned its overlay.
            view.dom.addEventListener("dragover", dragover);
            return {
                update(view, previous) {
                    overlay.update?.(view, previous);
                    refresh();
                },
                destroy() {
                    view.dom.removeEventListener("dragover", dragover);
                    overlay.destroy?.();
                }
            };
        }
    });
}