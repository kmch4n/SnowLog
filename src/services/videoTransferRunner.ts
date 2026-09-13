/**
 * 1 本の動画取得を最後まで進める手順（#86 §6）
 *
 * 依存はすべて引数で受け取る。ネイティブもファイルシステムも DB もここには
 * 無いので、確定までの順序・巻き戻し・失敗注入を実機なしで検証できる。
 *
 * **順序が仕様**である。ファイルが先に確定して DB があとから落ちると、
 * 誰も所有していないバイトがディスクに残る。DB が先に確定してファイルが
 * 落ちると、再生できない行が残る。前者は掃除で回収できるが、後者はできない。
 * だから「検証 → 記述子の保存 → rename → DB」の順で、各段の失敗が回収可能な
 * 側にしか倒れないようにする。
 *
 * import は相対のみ。素の `tsc <file>` が通る（`.memory/testing.md`）。
 */
import type {
    MediaFailureCode,
    MediaNetworkAccess,
    PreparedVideo,
} from "../types/media";
import type { VideoTransferOutput, VideoTransferPayload } from "./videoTransferJob";

/** 書き込み前に必ず残す空き容量。書ききった直後に OS が詰まるのを避ける */
export const FREE_SPACE_RESERVE_BYTES = 256 * 1024 * 1024;

export interface TransferRunnerDeps {
    /** ネットワークフラグを明示的に渡す。既定値を持たせない */
    prepare(
        assetId: string,
        requestId: string,
        networkAccess: MediaNetworkAccess
    ): Promise<PreparedVideo>;
    /** 取得済みファイルの後始末。成功しても失敗しても最後に呼ぶ */
    release(requestId: string): Promise<void>;
    /** 空き容量（バイト）。取得できなければ null */
    getFreeDiskBytes(): Promise<number | null>;
    /** ステージングから最終パスへ。同一コンテナ内の移動 */
    promote(stagedUri: string, relativePath: string): Promise<void>;
    /** 確定していないファイルを消す。投げない */
    discard(relativePath: string): Promise<void>;
    /** 検証済みの記述子を rename の前に焼き込む */
    saveOutput(output: VideoTransferOutput): Promise<void>;
    /** DB の確定。false は「行を作らない正当な理由があった」ことを表す */
    commit(output: VideoTransferOutput): Promise<boolean>;
}

export type TransferOutcome =
    | { kind: "committed"; output: VideoTransferOutput }
    | { kind: "skipped" }
    | { kind: "blocked"; code: MediaFailureCode };

export interface TransferContext {
    payload: VideoTransferPayload;
    requestId: string;
    /** ネットワークを使ってよいか。呼び出し側が方針とゲートから決める */
    networkAccess: MediaNetworkAccess;
    /** 中断要求。長い段の前後で見る */
    isCancelled(): boolean;
}

/**
 * 取得から確定までを 1 本走らせる。
 *
 * 投げない。失敗は `blocked` として返す——ここで例外にすると、呼び出し側の
 * catch が「キャンセル」「通信が要る」「容量不足」を一緒くたにしてしまい、
 * ジョブに残すべき理由が消える。
 */
export async function runVideoTransfer(
    context: TransferContext,
    deps: TransferRunnerDeps
): Promise<TransferOutcome> {
    const { payload, requestId } = context;

    if (context.isCancelled()) return blocked("cancelled");

    let prepared: PreparedVideo;
    try {
        prepared = await deps.prepare(
            payload.asset.assetId,
            requestId,
            context.networkAccess
        );
    } catch {
        return blocked("io_error");
    }

    if (prepared.kind === "blocked") return blocked(prepared.code);

    // ここから先は取得済みファイルを握っている。どの経路で抜けても release する。
    try {
        // 取得の最中にユーザーが止めていたら、確定させない。ファイルは release が
        // 片付ける。中断後に行を作ると、頼んでいない動画が増える。
        if (context.isCancelled()) return blocked("cancelled");

        const space = await deps.getFreeDiskBytes();
        // 容量が分からないときは止めない。分からないことを失敗として扱うと、
        // 計測できない端末で機能そのものが使えなくなる。
        if (space !== null && space < FREE_SPACE_RESERVE_BYTES) {
            return blocked("insufficient_space");
        }

        const output: VideoTransferOutput = {
            bytes: prepared.bytes,
            extension: prepared.extension,
            duration: prepared.duration,
            width: prepared.width,
            height: prepared.height,
        };

        // rename の前に記述子を保存する。rename 直後に落ちると、ディスクには
        // 完成品があるのにジョブはそれを知らない状態になる。先に書いておけば、
        // 復旧が「このファイルは検証済みか」を判断できる。
        try {
            await deps.saveOutput(output);
        } catch {
            return blocked("io_error");
        }

        if (context.isCancelled()) return blocked("cancelled");

        try {
            await deps.promote(prepared.localUri, payload.managedVideoPath);
        } catch {
            return blocked("io_error");
        }

        // ここから DB。失敗したら自分が置いたファイルだけを消す。掃除に任せると
        // 猶予時間のあいだ、誰のものでもないファイルが残る。
        let committed: boolean;
        try {
            committed = await deps.commit(output);
        } catch {
            await deps.discard(payload.managedVideoPath);
            return blocked("io_error");
        }

        if (!committed) {
            await deps.discard(payload.managedVideoPath);
            return { kind: "skipped" };
        }

        return { kind: "committed", output };
    } finally {
        await deps.release(requestId).catch(() => {});
    }
}

function blocked(code: MediaFailureCode): TransferOutcome {
    return { kind: "blocked", code };
}

/**
 * 取得結果を、ジョブに与える出来事へ翻訳する。
 *
 * `needs_network` だけが「失敗」ではなく「待ち」になる。通信が要るという事実は
 * 端末の状態であって、ジョブの欠陥ではない（#86 §12）。
 */
export function outcomeToJobEvent(
    outcome: TransferOutcome
):
    | { type: "complete" }
    | { type: "cancel" }
    | { type: "needsWifi" }
    | { type: "fail"; code: MediaFailureCode } {
    if (outcome.kind === "committed") return { type: "complete" };
    // 既に取り込み済みだった等の理由で行を作らなかった場合、意図は果たされて
    // いる。失敗として残すとユーザーが直せない再試行ボタンが残る。
    if (outcome.kind === "skipped") return { type: "complete" };
    if (outcome.code === "cancelled") return { type: "cancel" };
    if (outcome.code === "needs_network") return { type: "needsWifi" };
    return { type: "fail", code: outcome.code };
}
