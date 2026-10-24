import { taskCapacity } from "../../shared/task";

type WaitingTask = { start: () => void };

// Application-wide execution capacity; renderer queues still own domain scheduling.
export class TaskAdmission {
    private active = 0;
    private readonly waiting = new Set<WaitingTask>();

    constructor(private readonly capacity = taskCapacity) {
        if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error("Invalid task capacity.");
    }

    run<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (signal.aborted) {
                reject(signal.reason);
                return;
            }
            const finish = (): void => {
                this.active--;
                this.drain();
            };
            const task: WaitingTask = {
                start: () => {
                    signal.removeEventListener("abort", cancel);
                    this.active++;
                    // Reserve capacity before dispatch, including synchronous failures.
                    Promise.resolve().then(() => {
                        signal.throwIfAborted();
                        return operation();
                    }).then(value => {
                        finish();
                        resolve(value);
                    }, error => {
                        finish();
                        reject(error);
                    });
                }
            };
            const cancel = (): void => {
                if (!this.waiting.delete(task)) return;
                signal.removeEventListener("abort", cancel);
                reject(signal.reason);
            };
            signal.addEventListener("abort", cancel, { once: true });
            this.waiting.add(task);
            this.drain();
        });
    }

    private drain(): void {
        while (this.active < this.capacity && this.waiting.size) {
            const task = this.waiting.values().next().value!;
            this.waiting.delete(task);
            task.start();
        }
    }
}