import { type EditorState } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";
import { type InspectionGeometry, type InspectionPointer, type InspectionTarget } from "./geometry";
import { compositionPending } from "./composition";

export type TranscriptInspection = InspectionTarget & { control: boolean };
export type InspectionCallbacks = {
    onChange: (inspection: TranscriptInspection | null) => void;
    onSeek: (time: number) => void;
};

export function sameRect(left: DOMRect, right: DOMRect): boolean {
    return left.top === right.top && left.left === right.left && left.width === right.width && left.height === right.height;
}

export function sameInspection(left: TranscriptInspection | null, right: TranscriptInspection | null): boolean {
    if (left === right) return true;
    if (!left || !right) return false;
    // Information and measured rectangle groups are cached by identity; the anchor is a value snapshot.
    return left.information === right.information && left.rectangles === right.rectangles && sameRect(left.anchor, right.anchor)
        && left.keyboard === right.keyboard && left.pressed === right.pressed && left.control === right.control;
}

type InspectionState = {
    inspection: TranscriptInspection | null;
    control: boolean;
    pointer: InspectionPointer | null;
    hovered: InspectionTarget | null;
    keyboard: InspectionTarget | null;
    priority: "pointer" | "keyboard";
    activation: string | null;
};

export function inspectionController(view: EditorView, geometry: InspectionGeometry, options: InspectionCallbacks): {
    move: (event: PointerEvent) => void;
    leave: () => void;
    down: (event: PointerEvent) => void;
    click: (event: MouseEvent) => void;
    modifiers: (event: KeyboardEvent) => void;
    reset: () => void;
    focus: (event: FocusEvent) => void;
    blur: (event: FocusEvent) => void;
    refresh: () => void;
    update: (previous: EditorState) => void;
} {
    const state: InspectionState = {
        inspection: null, control: false, pointer: null, hovered: null, keyboard: null,
        priority: "pointer", activation: null
    };
    function inspect(preferred = state.priority): void {
        state.priority = preferred;
        view.dom.classList.toggle("transcript-seek", state.control && !!state.hovered?.information.range);
        // Ending the latest input reveals the other target rather than discarding it.
        const target = state.priority === "pointer" ? state.hovered ?? state.keyboard : state.keyboard ?? state.hovered;
        const next = target ? { ...target, control: state.control } : null;
        if (sameInspection(state.inspection, next)) return;
        state.inspection = next;
        options.onChange(next);
    }
    function setControl(value: boolean): boolean {
        if (state.control === value) return false;
        state.control = value;
        state.activation = null;
        state.keyboard = geometry.keyboard(state.control);
        return true;
    }
    function leave(): void {
        state.pointer = null;
        state.hovered = null;
        state.activation = null;
        inspect();
    }
    function move(event: PointerEvent): void {
        if (event.pointerType === "touch" || view.composing || compositionPending(view.state)) return leave();
        const changed = setControl(event.ctrlKey && !event.altKey && !event.metaKey);
        state.pointer = { x: event.clientX, y: event.clientY, pressed: event.buttons !== 0 };
        state.hovered = geometry.hover(state.pointer, state.hovered);
        inspect(state.hovered ? "pointer" : changed && state.control ? "keyboard" : state.priority);
    }
    function modifiers(event: KeyboardEvent): void {
        const next = event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing && !view.composing && !compositionPending(view.state);
        if (setControl(next)) {
            state.hovered = geometry.hover(state.pointer, state.hovered);
            inspect(state.control ? "keyboard" : state.priority);
        }
        if (event.type === "keydown" && event.key === "Enter" && state.control && !event.shiftKey && (view.dom.contains(document.activeElement) || state.hovered)) {
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat && state.inspection?.information.range) options.onSeek(state.inspection.information.range.start);
        }
    }
    function down(event: PointerEvent): void {
        state.activation = null;
        move(event);
        if (event.button !== 0 || !state.control || !state.hovered?.information.range) return;
        // Ctrl-click is an audio link, so suppress native caret/word selection in capture phase.
        event.preventDefault();
        event.stopPropagation();
        state.activation = state.hovered.information.key;
    }
    function click(event: MouseEvent): void {
        const item = state.hovered?.information;
        const key = state.activation;
        state.activation = null;
        if (event.button !== 0 || !event.ctrlKey || event.altKey || event.metaKey || !item?.range || item.key !== key) return;
        event.preventDefault();
        event.stopPropagation();
        options.onSeek(item.range.start);
    }
    function reset(): void {
        state.control = false;
        state.hovered = null;
        state.keyboard = null;
        state.activation = null;
        inspect();
    }
    function focus(event: FocusEvent): void {
        state.keyboard = geometry.keyboard(state.control, event.target);
        state.hovered = geometry.hover(state.pointer, state.hovered);
        inspect("keyboard");
    }
    function blur(event: FocusEvent): void {
        state.keyboard = geometry.keyboard(state.control, event.relatedTarget);
        state.hovered = geometry.hover(state.pointer, state.hovered);
        inspect();
    }
    function refresh(): void {
        if (view.isDestroyed) return;
        state.hovered = geometry.hover(state.pointer, state.hovered, true);
        state.keyboard = geometry.keyboard(state.control);
        inspect();
    }
    function update(previous: EditorState): void {
        // Phase transitions can be metadata-only transactions, with no document or selection change.
        if (compositionPending(view.state)) {
            if (!compositionPending(previous)) reset();
            return;
        }
        if (compositionPending(previous)) return refresh();
        const changed = view.state.doc !== previous.doc;
        if (changed) {
            state.activation = null;
            state.hovered = geometry.hover(state.pointer, state.hovered, true);
        }
        if (changed || !view.state.selection.eq(previous.selection)) {
            state.keyboard = geometry.keyboard(state.control);
            inspect(state.control ? "keyboard" : state.priority);
        }
    }
    return { move, leave, down, click, modifiers, reset, focus, blur, refresh, update };
}