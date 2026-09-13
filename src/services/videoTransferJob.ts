/**
 * 取得ジョブの状態遷移と payload の検証（#86 §6）
 *
 * 副作用を持たない純関数だけを置く。DB もファイルシステムもネイティブも触らない
 * ので、遷移の全体をネイティブ抜きで網羅的に検証できる。
 *
 * import は相対のみ。素の `tsc <file>` が通り、emit は `out/services/` へネスト
 * する（`.memory/testing.md`）。
 */
import type { ImportMetadata } from "../types";
import type { ImportVideoMetadata, MediaFailureCode } from "../types/media";

export type VideoTransferJobKind = "import" | "convert";

/**
 * ジョブの状態。
 *
 * `waiting_wifi` は「完了した取り込み」ではない。ライブラリの件数にも、
 * カレンダーにも、バックアップにも出てはいけない（#86 §6）。
 */
export type VideoTransferJobState =
    | "pending"
    | "running"
    | "waiting_wifi"
    | "paused"
    | "failed";

export const VIDEO_TRANSFER_JOB_STATES: readonly VideoTransferJobState[] = [
    "pending",
    "running",
    "waiting_wifi",
    "paused",
    "failed",
];

/** ジョブを前に進める / 止める出来事 */
export type VideoTransferEvent =
    | { type: "start" }
    | { type: "retry" }
    | { type: "needsWifi" }
    | { type: "wifiEligible" }
    | { type: "background" }
    | { type: "fail"; code: MediaFailureCode }
    | { type: "cancel" }
    | { type: "complete" };

/**
 * 遷移の結果。`removed` はジョブ行そのものが消えることを表す。
 *
 * 完了とキャンセルはどちらも行が消えるが、意味は違う。完了は `videos` に行が
 * できた結果で、キャンセルは意図の撤回。呼び出し側が取り違えないよう区別する。
 */
export type VideoTransferTransition =
    | { kind: "state"; state: VideoTransferJobState; errorCode: MediaFailureCode | null }
    | { kind: "removed"; reason: "completed" | "cancelled" }
    | { kind: "ignored" };

/**
 * 状態機械（#86 §9 Task D の表がそのままこれ）。
 *
 * 表に無い組み合わせは `ignored` を返し、例外にしない。遅れて届いたネイティブの
 * コールバックは日常的に起こるもので、異常ではない。投げると呼び出し側が握り潰す
 * 誘惑に負け、そこで本物の失敗も一緒に消える。
 */
export function applyVideoTransferEvent(
    state: VideoTransferJobState,
    event: VideoTransferEvent
): VideoTransferTransition {
    // キャンセルはどの保持状態からでも効く。ユーザーの撤回を状態で拒まない。
    if (event.type === "cancel") {
        return { kind: "removed", reason: "cancelled" };
    }

    switch (state) {
        case "pending":
            if (event.type === "start") return running();
            if (event.type === "background") return paused();
            return ignored();

        case "running":
            if (event.type === "needsWifi") return waitingWifi();
            if (event.type === "background") return paused();
            if (event.type === "fail") {
                return { kind: "state", state: "failed", errorCode: event.code };
            }
            if (event.type === "complete") {
                return { kind: "removed", reason: "completed" };
            }
            return ignored();

        case "waiting_wifi":
            // 適格になっただけでは走らせない。前景のキューが生きている前提は
            // 呼び出し側が持ち、ここは `pending` へ戻すだけ。
            if (event.type === "wifiEligible") return pending();
            if (event.type === "retry") return pending();
            if (event.type === "background") return paused();
            return ignored();

        case "paused":
            if (event.type === "retry") return pending();
            return ignored();

        case "failed":
            if (event.type === "retry") return pending();
            return ignored();
    }
}

function pending(): VideoTransferTransition {
    // 再試行のたびに失敗コードを消す。残すと UI が古い理由を出し続ける。
    return { kind: "state", state: "pending", errorCode: null };
}

function running(): VideoTransferTransition {
    return { kind: "state", state: "running", errorCode: null };
}

function waitingWifi(): VideoTransferTransition {
    return { kind: "state", state: "waiting_wifi", errorCode: null };
}

function paused(): VideoTransferTransition {
    return { kind: "state", state: "paused", errorCode: null };
}

function ignored(): VideoTransferTransition {
    return { kind: "ignored" };
}

/** 起動時の復旧で、この状態は「走っていたが落ちた」ことを意味する */
export function needsRecovery(state: VideoTransferJobState): boolean {
    return state === "running";
}

/** 値が状態として妥当か。DB から読んだ文字列を信用しないため */
export function isVideoTransferJobState(
    value: unknown
): value is VideoTransferJobState {
    return (
        typeof value === "string" &&
        (VIDEO_TRANSFER_JOB_STATES as readonly string[]).includes(value)
    );
}

/** 値が種別として妥当か */
export function isVideoTransferJobKind(
    value: unknown
): value is VideoTransferJobKind {
    return value === "import" || value === "convert";
}

/**
 * ジョブが抱えるスナップショット（#86 §6）。
 *
 * 取り込みの意図はユーザーが「取り込む」と言った瞬間に固まる。あとから写真
 * ライブラリを読み直して組み立て直さない——アセットは編集も削除もされうるし、
 * 読み直しはネットワークを起こしうる。
 *
 * ネットワーク許可も外部 URL も**入れない**。許可は 1 回の試行に閉じるもので、
 * 永続化した瞬間に「あとで勝手に使ってよい」という意味になる（#86 §12）。
 */
export interface VideoTransferPayload {
    version: 1;
    asset: ImportVideoMetadata;
    /** import のときだけ。convert では既存行のメタデータが正で、ここは null */
    metadata: ImportMetadata | null;
    /** 取り込み時に確定した保存意図。設定を変えても走行中のジョブは変わらない */
    storageIntent: "copy";
    /** 生成済みの最終相対パス */
    managedVideoPath: string;
    /** 検証を通ったあとにだけ入る。rename の前に保存する */
    output: VideoTransferOutput | null;
}

export interface VideoTransferOutput {
    bytes: number;
    extension: string;
    duration: number;
    width: number;
    height: number;
}

/** payload を JSON 文字列にする。DB へ入れる直前に 1 度だけ呼ぶ */
export function serializeVideoTransferPayload(
    payload: VideoTransferPayload
): string {
    return JSON.stringify(payload);
}

/**
 * DB から読んだ文字列を payload に戻す。壊れていれば null。
 *
 * 中身は自分で書いたものだが、アプリのバージョンをまたいで残る。壊れた行で
 * 落ちるより、そのジョブだけ失敗として扱ってユーザーに見せる方がよい。
 */
export function parseVideoTransferPayload(
    raw: string
): VideoTransferPayload | null {
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof value !== "object" || value === null) return null;

    const candidate = value as Record<string, unknown>;
    if (candidate.version !== 1) return null;
    if (candidate.storageIntent !== "copy") return null;
    if (typeof candidate.managedVideoPath !== "string") return null;
    if (!isImportVideoMetadata(candidate.asset)) return null;

    const metadata = candidate.metadata;
    if (metadata !== null && !isImportMetadata(metadata)) return null;

    const output = candidate.output;
    if (output !== null && !isVideoTransferOutput(output)) return null;

    return {
        version: 1,
        asset: candidate.asset,
        metadata: metadata as ImportMetadata | null,
        storageIntent: "copy",
        managedVideoPath: candidate.managedVideoPath,
        output: output as VideoTransferOutput | null,
    };
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isImportVideoMetadata(value: unknown): value is ImportVideoMetadata {
    if (typeof value !== "object" || value === null) return false;
    const asset = value as Record<string, unknown>;
    return (
        typeof asset.assetId === "string" &&
        typeof asset.filename === "string" &&
        isFiniteNumber(asset.capturedAt) &&
        isFiniteNumber(asset.duration) &&
        isFiniteNumber(asset.width) &&
        isFiniteNumber(asset.height)
    );
}

function isImportMetadata(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const metadata = value as Record<string, unknown>;
    return (
        typeof metadata.memo === "string" &&
        Array.isArray(metadata.tagIds) &&
        metadata.tagIds.every(isFiniteNumber) &&
        Array.isArray(metadata.techniques) &&
        metadata.techniques.every((item) => typeof item === "string")
    );
}

function isVideoTransferOutput(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const output = value as Record<string, unknown>;
    return (
        isFiniteNumber(output.bytes) &&
        output.bytes > 0 &&
        typeof output.extension === "string" &&
        isFiniteNumber(output.duration) &&
        isFiniteNumber(output.width) &&
        isFiniteNumber(output.height)
    );
}
