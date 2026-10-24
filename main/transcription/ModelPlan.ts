// Filenames stay relative to the selected model directory so native argv can
// use the task-local "models" link without losing each file's explicit role.
export type ModelPlan = {
    files: { role: string; filename: string }[];
    options: Record<string, string>;
    strategy: { kind: "native" } | { kind: "qwen3-asr"; fallbackTemperature: number | null };
};