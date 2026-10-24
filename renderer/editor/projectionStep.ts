import { type Node, type Schema } from "@tiptap/pm/model";
import { Step, StepResult } from "@tiptap/pm/transform";
import { type Modification } from "../../shared/Vestige";
import { type TextProjection } from "../../shared/transcript/text";

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