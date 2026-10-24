import { type AbsolutePath } from "../../../shared/util/path";
import { type ModelPlan } from "../ModelPlan";

export const modelFilename = "model.bin";

export function resolveModel(_directory: AbsolutePath, options: Readonly<Record<string, string>>): ModelPlan {
    return { files: [{ role: "model", filename: modelFilename }], options: { ...options }, strategy: { kind: "native" } };
}