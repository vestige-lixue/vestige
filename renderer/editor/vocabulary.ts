import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { type VocabularyMatch } from "../../shared/vocabulary/match";
import { type TranscriptMenuRequest } from "./menuTarget";
import { compositionActive, compositionPending } from "./composition";

const previewKey = new PluginKey<DecorationSet>("vestigeVocabularyPreview");

export function vocabularyPreviewPlugin(): Plugin<DecorationSet> {
    return new Plugin<DecorationSet>({
        key: previewKey,
        state: {
            init: () => DecorationSet.empty,
            apply(transaction, previous, _oldState, state) {
                if (transaction.docChanged || compositionActive(state)) return DecorationSet.empty;
                const match: VocabularyMatch | null | undefined = transaction.getMeta(previewKey);
                if (match === undefined) return previous;
                return match ? DecorationSet.create(transaction.doc, [
                    Decoration.inline(match.from + 1, match.to + 1, { class: "transcript-vocabulary-match" })
                ]) : DecorationSet.empty;
            }
        },
        props: { decorations: state => previewKey.getState(state) }
    });
}

export function previewVocabulary(request: TranscriptMenuRequest, match: VocabularyMatch | null): void {
    const { view } = request;
    if (view.isDestroyed) return;
    if (request.doc !== view.state.doc || view.composing || compositionPending(view.state)) match = null;
    const current = previewKey.getState(view.state)?.find()[0];
    if (!match && !current || match && current?.from === match.from + 1 && current.to === match.to + 1) return;
    view.dispatch(view.state.tr.setMeta(previewKey, match).setMeta("addToHistory", false));
}