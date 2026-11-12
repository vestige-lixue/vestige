import { Fragment, type Node, type Schema } from "@tiptap/pm/model";
import { type EditorState, type Transaction } from "@tiptap/pm/state";
import { Step, StepResult } from "@tiptap/pm/transform";
import { type Modification } from "../../shared/Vestige";
import { type TextProjection } from "../../shared/transcript/text";

type Replacement = { from: number; to: number } & ({ text: string } | { content: Fragment });

// The projection owns provenance; trimming equal displayed characters here only limits DOM changes.
function changedText(before: string, after: string): Replacement | null {
    const original = Array.from(before), inserted = Array.from(after);
    let start = 0, oldEnd = original.length, newEnd = inserted.length;
    while (start < oldEnd && start < newEnd && original[start] === inserted[start]) start++;
    while (oldEnd > start && newEnd > start && original[oldEnd - 1] === inserted[newEnd - 1]) {
        oldEnd--; newEnd--;
    }
    if (start === oldEnd && start === newEnd) return null;
    const from = original.slice(0, start).join("").length;
    return { from, to: from + original.slice(start, oldEnd).join("").length, text: inserted.slice(start, newEnd).join("") };
}

export function projectionTransaction(state: EditorState, before: TextProjection, after: TextProjection, replacement?: Replacement): Transaction {
    const transaction = state.tr;
    const change = replacement ?? changedText(before.text, after.text);
    if (change) {
        const content = "content" in change ? change.content : Fragment.fromArray(change.text.split("\n").flatMap((line, i) => [
            ...i ? [state.schema.nodes.hardBreak.create()] : [], ...line ? [state.schema.text(line)] : []
        ]));
        transaction.replaceWith(change.from + 1, change.to + 1, content);
    }
    return transaction.step(new ProjectionStep(before.modifications, after.modifications, before, after));
}

// History owns source snapshots without changing document markup (which would rebuild its DOM).
// Positions are immutable Run coordinates, so mapping document edits does not move these anchors.
export class ProjectionStep extends Step {
    constructor(
        readonly before: Modification[],
        readonly after: Modification[],
        readonly beforeProjection?: TextProjection,
        readonly afterProjection?: TextProjection,
        readonly restoreSelection = false
    ) {
        super();
    }

    apply(doc: Node): StepResult {
        return StepResult.ok(doc);
    }
    invert(): ProjectionStep {
        return new ProjectionStep(this.after, this.before, this.afterProjection, this.beforeProjection, this.restoreSelection);
    }
    map(): ProjectionStep {
        return this;
    }
    toJSON(): object {
        return { stepType: "vestigeProjection", before: this.before, after: this.after, restoreSelection: this.restoreSelection };
    }
    static fromJSON(_schema: Schema, json: { before: Modification[]; after: Modification[]; restoreSelection?: boolean }): ProjectionStep {
        return new ProjectionStep(json.before, json.after, undefined, undefined, json.restoreSelection);
    }
}

// HMR re-executes this module whenever a shared dependency changes, and ProseMirror rejects a second registration.
if (!import.meta.hot?.data.projectionStepRegistered) {
    Step.jsonID("vestigeProjection", ProjectionStep);
    if (import.meta.hot) import.meta.hot.data.projectionStepRegistered = true;
}