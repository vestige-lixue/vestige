import { type EditorState } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";
import { type InspectionGeometry, type InspectionPointer, type InspectionTarget } from "./geometry";
import { compositionPending } from "./composition";

// Chords such as Ctrl+C or ⌘C press their key within this delay, so they never flash control inspection.
const controlDelay = 250;
// Modifiers and caret movement keep a held inspection modifier inspecting; any other key turns the hold into a chord.
const holdKeys = new Set(["Control", "Shift", "Alt", "AltGraph", "Meta", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

// Inspection uses the primary modifier: Command on macOS, where Control-click is a secondary click, and Ctrl elsewhere.
const mac = (): boolean => window.api.platform === "darwin";
export function inspectionKey(): "Meta" | "Control" {
    return mac() ? "Meta" : "Control";
}
function primary(event: KeyboardEvent | MouseEvent): boolean {
    return mac() ? event.metaKey : event.ctrlKey;
}
/** The inspection modifier without Alt or the other platform's primary modifier. */
function inspectionModifier(event: KeyboardEvent | MouseEvent): boolean {
    return primary(event) && (mac() ? !event.ctrlKey : !event.metaKey) && !event.altKey;
}

export type TranscriptInspection = InspectionTarget & { control: boolean; menu?: boolean };
export type InspectionCallbacks = {
    onChange: (inspection: TranscriptInspection | null) => void;
    onSeek: (time: number) => void;
    onHover?: (hovered: boolean) => void;
};

export function sameRect(left: DOMRect, right: DOMRect): boolean {
    return left.top === right.top && left.left === right.left && left.width === right.width && left.height === right.height;
}

export function sameInspection(left: TranscriptInspection | null, right: TranscriptInspection | null): boolean {
    if (left === right) return true;
    if (!left || !right) return false;
    // Information and measured rectangle groups are cached by identity; the anchor is a value snapshot.
    return left.information === right.information && left.rectangles === right.rectangles && sameRect(left.anchor, right.anchor)
        && left.keyboard === right.keyboard && left.pressed === right.pressed && left.control === right.control && left.menu === right.menu;
}

type InspectionState = {
    inspection: TranscriptInspection | null;
    /** The inspection modifier is down: modifier-click and modifier+Enter seek at once. */
    held: boolean;
    /** A key other than a modifier or caret movement was pressed during this hold. */
    chorded: boolean;
    /** Control inspection, shown once the modifier has been held alone for the delay. */
    control: boolean;
    pointer: InspectionPointer | null;
    hovered: InspectionTarget | null;
    keyboard: InspectionTarget | null;
    priority: "pointer" | "keyboard";
    activation: string | null;
};

export function inspectionController(view: EditorView, geometry: InspectionGeometry, options: InspectionCallbacks): {
    move: (event: PointerEvent) => void;
    leave: (event?: PointerEvent) => void;
    down: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
    click: (event: MouseEvent) => void;
    modifiers: (event: KeyboardEvent) => void;
    reset: () => void;
    focus: (event: FocusEvent) => void;
    blur: (event: FocusEvent) => void;
    refresh: () => void;
    update: (previous: EditorState) => void;
    pinMenu: (target: (() => InspectionTarget | null) | null, pending?: boolean) => void;
} {
    const state: InspectionState = {
        inspection: null, held: false, chorded: false, control: false, pointer: null, hovered: null, keyboard: null,
        priority: "pointer", activation: null
    };
    let controlTimer: ReturnType<typeof setTimeout> | undefined;
    let displayed: TranscriptInspection | null = null;
    let menuTarget: (() => InspectionTarget | null) | null = null;
    let menuPending = false;
    let focused: HTMLElement | null = null;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    function settleFocus(element: EventTarget | null): void {
        const next = !view.composing && !compositionPending(view.state) && document.hasFocus() && element instanceof HTMLElement
            && view.dom.contains(element) && element.matches(".transcript-event:focus-visible") ? element : null;
        if (focused === next) return;
        clearTimeout(focusTimer);
        focusTimer = undefined;
        focused = next;
        if (!next) return;
        focusTimer = setTimeout(() => {
            focusTimer = undefined;
            if (view.isDestroyed || document.activeElement !== next || !document.hasFocus()) return;
            state.keyboard = geometry.keyboard(state.control);
            inspect();
        }, 100);
    }
    function inspect(preferred = state.priority): void {
        state.priority = preferred;
        view.dom.classList.toggle("transcript-seek", state.held && !!state.hovered?.information.range);
        // Ending the latest input reveals the other target rather than discarding it.
        const target = menuTarget ? menuTarget() : state.priority === "pointer" ? state.hovered ?? state.keyboard : state.keyboard ?? state.hovered;
        const menu = menuPending || !!menuTarget;
        const next = target ? { ...target, control: menu ? false : state.control, menu } : null;
        // Commands follow native focus immediately; only the visual details wait for Tab to settle.
        state.inspection = next;
        if (!menu && focusTimer !== undefined && next?.keyboard && !next.control || sameInspection(displayed, next)) return;
        displayed = next;
        options.onChange(next);
    }
    function setControl(value: boolean): boolean {
        clearTimeout(controlTimer);
        controlTimer = undefined;
        if (state.control === value) return false;
        state.control = value;
        state.keyboard = geometry.keyboard(state.control);
        return true;
    }
    function retarget(): void {
        state.hovered = geometry.hover(state.pointer, state.hovered);
        inspect(state.control ? "keyboard" : state.priority);
    }
    /** Returns whether the hold or control inspection changed synchronously. */
    function hold(value: boolean): boolean {
        const changed = state.held !== value;
        if (changed) {
            state.held = value;
            // Modifier-click needs the modifier held from press to release.
            state.activation = null;
        }
        if (!value || state.chorded) return setControl(false) || changed;
        if (!state.control && controlTimer === undefined) controlTimer = setTimeout(() => {
            controlTimer = undefined;
            if (!view.isDestroyed && setControl(true)) retarget();
        }, controlDelay);
        return changed;
    }
    function leave(event?: PointerEvent): void {
        if (event?.type === "pointerleave") options.onHover?.(false);
        if (event?.type === "pointerleave" && state.pointer?.pressed) return move(event);
        state.pointer = null;
        state.hovered = null;
        state.activation = null;
        inspect();
    }
    function move(event: PointerEvent): void {
        if (event.pointerType === "touch" || view.composing || compositionPending(view.state)) return leave();
        if (!primary(event)) state.chorded = false;
        hold(inspectionModifier(event));
        state.pointer = { x: event.clientX, y: event.clientY, pressed: event.buttons !== 0 };
        state.hovered = geometry.hover(state.pointer, state.hovered);
        options.onHover?.(event.type !== "pointerleave" && (!!state.hovered || geometry.containsAddedText(state.pointer)));
        inspect(state.hovered ? "pointer" : state.priority);
    }
    function modifiers(event: KeyboardEvent): void {
        // Releasing the modifier ends the hold, together with any chord made during it.
        if (!primary(event)) state.chorded = false;
        const held = inspectionModifier(event) && !event.isComposing && !view.composing && !compositionPending(view.state);
        const seek = !menuPending && !menuTarget && event.type === "keydown" && event.key === "Enter" && held && !event.shiftKey
            && (view.dom.contains(document.activeElement) || !!state.hovered);
        if (!seek) {
            if (event.type === "keydown" && primary(event) && !holdKeys.has(event.key)) state.chorded = true;
            if (hold(held)) retarget();
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        // Seeking acts on the inspected target, so it shows inspection at once instead of ending it as a chord.
        state.chorded = false;
        const changed = hold(true);
        if (setControl(true) || changed) retarget();
        if (!event.repeat && state.inspection?.information.range) options.onSeek(state.inspection.information.range.start);
    }
    function down(event: PointerEvent): void {
        state.activation = null;
        move(event);
        if (event.button !== 0 || !state.held) return;
        const target = geometry.hover(state.pointer, null, { selection: false });
        if (!target?.information.range) return;
        // Modifier-click is an audio link, so suppress native caret/word selection in capture phase.
        event.preventDefault();
        event.stopPropagation();
        state.activation = target.information.key;
    }
    function up(event: PointerEvent): void {
        if (state.pointer?.pressed) move(event);
    }
    function click(event: MouseEvent): void {
        const key = state.activation;
        state.activation = null;
        if (event.button !== 0 || !inspectionModifier(event) || !key) return;
        const item = geometry.hover(state.pointer, null, { selection: false })?.information;
        if (!item?.range || item.key !== key) return;
        event.preventDefault();
        event.stopPropagation();
        options.onSeek(item.range.start);
    }
    function reset(): void {
        settleFocus(null);
        clearTimeout(controlTimer);
        controlTimer = undefined;
        state.held = false;
        state.chorded = false;
        state.control = false;
        if (state.pointer) state.pointer.pressed = false;
        state.hovered = null;
        state.keyboard = null;
        state.activation = null;
        inspect();
    }
    function focus(event: FocusEvent): void {
        settleFocus(event.target);
        state.keyboard = geometry.keyboard(state.control, event.target);
        inspect("keyboard");
    }
    function blur(event: FocusEvent): void {
        settleFocus(null);
        // The incoming focus event handles internal moves once, without an intermediate hover update.
        if (event.relatedTarget instanceof Node && view.dom.contains(event.relatedTarget)) return;
        state.keyboard = null;
        inspect();
    }
    function refresh(): void {
        if (view.isDestroyed) return;
        settleFocus(document.activeElement);
        state.hovered = geometry.hover(state.pointer, state.hovered, { measure: true });
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
        if (changed || !view.state.selection.eq(previous.selection)) {
            state.activation = null;
            state.hovered = geometry.hover(state.pointer, state.hovered, { measure: true });
            state.keyboard = geometry.keyboard(state.control);
            inspect(state.control ? "keyboard" : state.priority);
        }
    }
    function pinMenu(target: (() => InspectionTarget | null) | null, pending = false): void {
        menuTarget = target;
        menuPending = pending;
        refresh();
    }
    return { move, leave, down, up, click, modifiers, reset, focus, blur, refresh, update, pinMenu };
}