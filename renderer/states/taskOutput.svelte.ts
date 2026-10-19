import { type TaskSnapshot } from "../../shared/task";
import { type FailureInfo, toFailureInfo } from "../../shared/failure";

type TaskOutputState = {
    snapshot: TaskSnapshot | null;
    loading: boolean;
    error: FailureInfo | null;
};

export function observe(getTaskId: () => string | null): TaskOutputState {
    const state = $state<TaskOutputState>({ snapshot: null, loading: true, error: null });
    $effect(() => {
        const id = getTaskId();
        let disposed = false;
        let sequence = -1;
        state.snapshot = null;
        state.loading = !!id;
        state.error = null;
        if (!id) return;

        function receive(next: TaskSnapshot): void {
            if (disposed || next.id !== id || next.sequence <= sequence) return;
            sequence = next.sequence;
            state.snapshot = next;
            state.loading = false;
        }
        const unsubscribe = window.api.taskOutput.subscribe(id, receive);
        void window.api.taskOutput.get(id).then(next => {
            if (next) receive(next);
        }).catch(error => {
            if (!disposed) state.error = toFailureInfo(error);
        }).finally(() => {
            if (!disposed) state.loading = false;
        });
        return () => {
            disposed = true;
            unsubscribe();
        };
    });
    return state;
}