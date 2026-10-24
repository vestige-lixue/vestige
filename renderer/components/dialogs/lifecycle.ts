export type DialogLifecycle = { closed: () => void };
export const dialogLifecycleKey = Symbol("dialog lifecycle");