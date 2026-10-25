/**
 * A single-slot debounced task.
 *
 * `schedule` replaces whatever is pending and restarts the delay. `flush` runs
 * the pending task now instead of dropping it — use it when the owner goes
 * away (screen unmount) so an edit typed just before leaving is still saved.
 * `cancel` drops the pending task without running it.
 *
 * Each task runs at most once, whether it fires on its own or is flushed.
 */
export interface DebouncedTask {
    schedule(task: () => void): void;
    flush(): void;
    cancel(): void;
}

export function createDebouncedTask(delayMs: number): DebouncedTask {
    let pending: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function clearTimer() {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    }

    function run() {
        clearTimer();
        const task = pending;
        pending = null;
        task?.();
    }

    return {
        schedule(task) {
            clearTimer();
            pending = task;
            timer = setTimeout(run, delayMs);
        },
        flush() {
            run();
        },
        cancel() {
            clearTimer();
            pending = null;
        },
    };
}
