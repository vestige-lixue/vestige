import { Fragment, type Node, type Schema } from "@tiptap/pm/model";
import { type EditorState, type Transaction } from "@tiptap/pm/state";
import { Step, StepResult } from "@tiptap/pm/transform";
import { type Modification } from "../../shared/Vestige";
import { type TextProjection } from "../../shared/transcript/text";

// The projection owns provenance; trimming equal displayed characters here only limits DOM changes.
export function projectionTransaction(state: EditorState, before: TextProjection, after: TextProjection, replacement?: { from: number; to: number; text: string }): Transaction {
    const original = Array.from(before.text), inserted = Array.from(after.text);
    let start = 0, oldEnd = original.length, newEnd = inserted.length;
    while (start < oldEnd && start < newEnd && original[start] === inserted[start]) start++;
    while (oldEnd > start && newEnd > start && original[oldEnd - 1] === inserted[newEnd - 1]) {
        oldEnd--; newEnd--;
    }
    const transaction = state.tr;
    if (replacement || oldEnd > start || newEnd > start) {
        const text = replacement?.text ?? inserted.slice(start, newEnd).join("");
        const nodes = text.split("\n").flatMap((line, i) => [
            ...i ? [state.schema.nodes.hardBreak.create()] : [], ...line ? [state.schema.text(line)] : []
        ]);
        const from = (replacement?.from ?? original.slice(0, start).join("").length) + 1;
        const to = replacement ? replacement.to + 1 : from + original.slice(start, oldEnd).join("").length;
        transaction.replaceWith(from, to, Fragment.fromArray(nodes));
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
        readonly afterProjection?: TextProjection
    ) {
        super();
    }

    apply(doc: Node): StepResult {
        return StepResult.ok(doc);
    }
    invert(): ProjectionStep {
        return new ProjectionStep(this.after, this.before, this.afterProjection, this.beforeProjection);
    }
    map(): ProjectionStep {
        return this;
    }
    toJSON(): object {
        return { stepType: "vestigeProjection", before: this.before, after: this.after };
    }
    static fromJSON(_schema: Schema, json: { before: Modification[]; after: Modification[] }): ProjectionStep {
        return new ProjectionStep(json.before, json.after);
    }
}

Step.jsonID("vestigeProjection", ProjectionStep);