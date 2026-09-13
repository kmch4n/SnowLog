/**
 * メディアを変更する操作の直列化（#86 §6）
 *
 * 取り込み・変換・削除・復元・掃除が同じ順番待ちに並ぶ。並行に走らせると、
 * 掃除が取り込み中のファイルを孤児と判定したり、削除が変換中の行を消したり
 * できてしまう。どれも「片方が正しく動いていても壊れる」種類の競合なので、
 * 個々の関数をいくら堅くしても防げない。
 *
 * 動画本体の転送は同時に 1 本だけ。ここで待つのは**転送そのもの**であって、
 * メタデータやサムネイルの読み取りは対象外——それらは別に上限を持つ。
 *
 * import を持たないので素の `tsc <file>` が通る（`.memory/testing.md`）。
 */

/** 実行中の操作を外から止めるためのハンドル */
export interface MutationHandle {
    /** 中断が要求されたか。長い処理はこれを定期的に見る */
    readonly isCancelled: boolean;
}

interface QueueEntry {
    run: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
    handle: { isCancelled: boolean };
}

/**
 * 直列コーディネータ。
 *
 * **キャンセルはロックを取らずに効く。** 実行中の操作を止めるのに順番待ちへ
 * 並ぶ設計にすると、止めたい相手が終わるまで止められないという堂々巡りになる。
 * `cancelAll` と `cancel` はキューに触らず、フラグだけを立てる。
 */
export class MediaMutationCoordinator {
    private queue: QueueEntry[] = [];
    private current: QueueEntry | null = null;
    private draining = false;

    /** 順番待ちと実行中を合わせた件数 */
    get pendingCount(): number {
        return this.queue.length + (this.current === null ? 0 : 1);
    }

    get isBusy(): boolean {
        return this.current !== null;
    }

    /**
     * 操作を順番に実行する。`run` は自分のハンドルを受け取り、長い処理の途中で
     * `isCancelled` を確認する責任を負う。
     */
    run<T>(operation: (handle: MutationHandle) => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const handle = { isCancelled: false };
            this.queue.push({
                run: () => operation(handle),
                resolve: resolve as (value: unknown) => void,
                reject,
                handle,
            });
            void this.drain();
        });
    }

    /** 実行中と順番待ちのすべてに中断を要求する。待たない */
    cancelAll(): void {
        if (this.current !== null) this.current.handle.isCancelled = true;
        for (const entry of this.queue) entry.handle.isCancelled = true;
    }

    private async drain(): Promise<void> {
        if (this.draining) return;
        this.draining = true;
        try {
            while (this.queue.length > 0) {
                const entry = this.queue.shift();
                if (entry === undefined) break;
                this.current = entry;
                try {
                    entry.resolve(await entry.run());
                } catch (error) {
                    entry.reject(error);
                } finally {
                    this.current = null;
                }
            }
        } finally {
            this.draining = false;
        }
    }
}

/**
 * アプリ全体で 1 つ。直列化は「全員が同じ列に並ぶ」ことでしか成立しないので、
 * 呼び出し側が自前のインスタンスを作ってはいけない。
 */
export const mediaMutationCoordinator = new MediaMutationCoordinator();
