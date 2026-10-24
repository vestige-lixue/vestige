import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";

type CompositionPhase = "idle" | "active" | "committing";
const compositionKey = new PluginKey<CompositionPhase>("vestigeComposition");

export function compositionActive(state: EditorState): boolean {
    return compositionKey.getState(state) === "active";
}

export function compositionPending(state: EditorState): boolean {
    return (compositionKey.getState(state) ?? "idle") !== "idle";
}

export function compositionCommit(transaction: Transaction): boolean {
    return transaction.getMeta(compositionKey) === "committing";
}

export function compositionPlugin(): Plugin<CompositionPhase> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    function cancel(): void {
        generation++;
        clearTimeout(timer);
        timer = undefined;
    }
    return new Plugin<CompositionPhase>({
        key: compositionKey,
        state: {
            init: () => "idle",
            apply: (transaction, phase) => transaction.getMeta(compositionKey) ?? phase
        },
        props: {
            handleDOMEvents: {
                compositionstart(view) {
                    cancel();
                    view.dispatch(view.state.tr.setMeta(compositionKey, "active").setMeta("addToHistory", false));
                    return false;
                },
                compositionend(view) {
                    const current = generation;
                    clearTimeout(timer);
                    // Let ProseMirror consume the final DOM input before replacing composition-owned marks.
                    timer = setTimeout(() => {
                        timer = undefined;
                        if (view.isDestroyed || view.composing || generation !== current) return;
                        // Appended bridge steps enter history; information still maps its existing widgets.
                        view.dispatch(view.state.tr.setMeta(compositionKey, "committing"));
                        if (view.isDestroyed || view.composing || generation !== current) return;
                        // Only after the bridge finishes may information rebuild and inspection measure DOM.
                        view.dispatch(view.state.tr.setMeta(compositionKey, "idle").setMeta("addToHistory", false));
                    }, 0);
                    return false;
                }
            }
        },
        view: () => ({ destroy: cancel })
    });
}