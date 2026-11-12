export type FindController = {
    selectedText: () => string;
    refresh: () => void;
    clear: () => void;
    focusEditor: () => void;
    navigate: (direction: -1 | 1) => void;
    replace: (all: boolean) => void;
    canReplace: () => boolean;
};

export const state = $state({
    open: false, expanded: false, query: "", replacement: "", caseSensitive: false, wholeWord: false, preserveCase: false,
    count: 0, current: -1, composing: false, inputComposing: false,
    focusRequest: 0, focusReplacement: false
});
let controller = $state.raw<FindController | null>(null);

export function register(value: FindController): () => void {
    controller = value;
    if (state.open) value.refresh();
    return () => {
        if (controller !== value) return;
        controller = null;
        state.count = 0;
        state.current = -1;
        state.composing = false;
    };
}

export function available(): boolean {
    return controller !== null;
}

export function open(replace: boolean): void {
    if (!controller) return;
    if (state.open && !replace) {
        state.focusReplacement = false;
        state.focusRequest++;
        return;
    }
    const selected = controller.selectedText();
    if (selected && !/[\r\n\u2028\u2029]/u.test(selected)) state.query = selected;
    state.open = true;
    state.expanded = replace;
    controller.refresh();
    state.focusReplacement = replace;
    state.focusRequest++;
}

export function close(): void {
    state.open = false;
    state.inputComposing = false;
    controller?.clear();
    controller?.focusEditor();
}

export function setQuery(query: string): void {
    state.query = query;
    controller?.refresh();
}

export function toggle(option: "caseSensitive" | "wholeWord" | "preserveCase"): void {
    state[option] = !state[option];
    if (option !== "preserveCase") controller?.refresh();
}

export function navigate(direction: -1 | 1): void {
    controller?.navigate(direction);
}

export function canReplace(): boolean {
    return !!controller && state.open && state.count > 0 && !state.composing && !state.inputComposing && controller.canReplace();
}

export function replace(all: boolean): void {
    if (canReplace()) controller?.replace(all);
}