/**
 * 起動時のジョブ突き合わせ（#86 §6「Foreground and recovery semantics」）
 *
 * プロセスが落ちた時点で、ディスクと DB とジョブ表は互いにずれうる。ここは
 * そのずれをどう解くかだけを決める純関数で、IO は呼び出し側が行う。
 *
 * **掃除より先に走らせること。** 掃除は「どの行にも参照されていないファイル」を
 * 消す。復旧前は、確定しかけた成果物がまさにその状態なので、順序を逆にすると
 * 取得し終えたファイルを取りこぼす。
 *
 * import は相対のみ。素の `tsc <file>` が通る（`.memory/testing.md`）。
 */
import type { VideoTransferJobState } from "./videoTransferJob";

/** 復旧が判断するために要る、ジョブ 1 件ぶんの外界の様子 */
export interface RecoveryObservation {
    jobId: string;
    state: VideoTransferJobState;
    /** payload が壊れていれば false。中身は見ない */
    payloadValid: boolean;
    /** 検証済み記述子が payload に入っているか */
    hasVerifiedOutput: boolean;
    /** 最終パスにファイルが存在するか */
    finalFileExists: boolean;
    /** 記述子のバイト数と実ファイルが一致するか。ファイルが無ければ false */
    finalFileMatchesOutput: boolean;
    /** この動画 ID の行が既に `videos` にあるか */
    videoRowExists: boolean;
}

export type RecoveryAction =
    /** ジョブ行を消すだけ。動画は既にライブラリにある */
    | { kind: "dropJob"; reason: "alreadyCommitted" }
    /** 検証済みのファイルが残っている。payload のスナップショットで確定させる */
    | { kind: "finalize" }
    /** 意図を残したまま止める。再開はユーザーの操作を待つ */
    | { kind: "pause" }
    /** 意図を残したまま失敗にする。理由を見せて再試行させる */
    | { kind: "fail"; code: "source_changed" | "io_error" }
    /** 何もしない */
    | { kind: "keep" };

export interface RecoveryPlan {
    jobId: string;
    action: RecoveryAction;
    /** 消してよい未確定ファイルがあるか。最終パスのファイルを指す */
    discardFinalFile: boolean;
}

/**
 * ジョブ 1 件の復旧方法を決める。
 *
 * 判断の順序そのものが仕様である。先に「既に確定しているか」を見るのは、
 * 確定済みの動画に対してジョブ側の情報で上書きをかけないため。
 */
export function planTransferRecovery(
    observation: RecoveryObservation
): RecoveryPlan {
    const { jobId } = observation;

    // 1. 行が既にある = 前回の確定は通っていた。ジョブは残骸なので消す。
    //    ファイルには触らない——その行が使っている。
    if (observation.videoRowExists) {
        return {
            jobId,
            action: { kind: "dropJob", reason: "alreadyCommitted" },
            discardFinalFile: false,
        };
    }

    // 2. payload が読めないジョブは前に進めない。意図は残すが、再試行しても
    //    同じところで止まるので失敗として見せる。黙って消さないのは、何が
    //    消えたのか利用者に分かるようにするため。
    if (!observation.payloadValid) {
        return {
            jobId,
            action: { kind: "fail", code: "io_error" },
            discardFinalFile: observation.finalFileExists,
        };
    }

    // 3. 検証済みの記述子と、それに一致するファイルが残っている。取得は完了
    //    していて DB だけが間に合わなかった状態なので、取り直さずに確定させる。
    if (observation.hasVerifiedOutput && observation.finalFileExists) {
        if (observation.finalFileMatchesOutput) {
            return { jobId, action: { kind: "finalize" }, discardFinalFile: false };
        }
        // 記述子と中身が食い違う。どちらが正しいか決められないので、確信の
        // 持てない内容を行に結び付けない。意図は残す。
        return {
            jobId,
            action: { kind: "fail", code: "source_changed" },
            discardFinalFile: true,
        };
    }

    // 4. ここから先は成果物が無いか未検証。中途半端なファイルは書き手が死んだ
    //    時点で閉じており、続きから書けない。捨てて、次はゼロからやり直す。
    const discardFinalFile = observation.finalFileExists;

    // 5. 走っていた最中に落ちた。失敗ではないので理由は付けず、止めるだけ。
    //    自動で再開しない——起動しただけで通信が始まるのは #86 §12 が禁じている。
    if (observation.state === "running") {
        return { jobId, action: { kind: "pause" }, discardFinalFile };
    }

    // 6. それ以外（pending / waiting_wifi / paused / failed）は、そのままで
    //    意味が通っている。ファイルの残骸だけ片付ける。
    return { jobId, action: { kind: "keep" }, discardFinalFile };
}

/** 観測の一覧から計画の一覧を作る。順序は入力のまま */
export function planTransferRecoveries(
    observations: readonly RecoveryObservation[]
): RecoveryPlan[] {
    return observations.map(planTransferRecovery);
}
