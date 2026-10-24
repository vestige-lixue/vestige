export type DialogLifecycle = { closed: () => void; closeRejected: () => void };
export const dialogLifecycleKey = Symbol("dialog lifecycle");