/**
 * 取得を発行してよいかの判定（#86 §12）
 *
 * ネイティブが観測した経路の状態と、選ばれた優先軸と、いまユーザーが何を
 * 求めているかから、**このリクエストにネットワークを許すか**を決める。
 *
 * ここが決めるのは「アプリが何を要求するか」だけである。PhotoKit がどの回線を
 * 使うかは制御できない（§12.6）。適格性を見て発行を止めるのはベストエフォート
 * のスケジューリングであって、セルラーの禁止ではない——その区別を文言にも
 * 実装にも残すこと。
 *
 * import を持たないので素の `tsc <file>` が通る（`.memory/testing.md`）。
 */

/** ネイティブの NWPathMonitor が観測した経路 */
export interface NetworkPathState {
    /** 現在の観測結果を持っているか。起動直後は false になりうる */
    hasCurrentPath: boolean;
    /** 経路が satisfied か */
    isSatisfied: boolean;
    usesWifi: boolean;
    /** 従量制と判定されているか */
    isExpensive: boolean;
    /** 低データモード等で制約されているか */
    isConstrained: boolean;
    /** 観測された経路にセルラーインターフェースが含まれるか */
    hasCellular: boolean;
}

/**
 * Wi-Fi として適格か（#86 §12.2）。
 *
 * **不明は不適格**に倒す。観測が無い状態を「たぶん Wi-Fi」と扱うと、起動直後の
 * 一瞬だけ判定を素通りする窓ができる。アイコンが Wi-Fi でも、expensive や
 * constrained が付いていれば適格ではない。
 */
export function isEligibleWifiPath(path: NetworkPathState): boolean {
    if (!path.hasCurrentPath) return false;
    if (!path.isSatisfied) return false;
    if (!path.usesWifi) return false;
    if (path.isExpensive) return false;
    if (path.isConstrained) return false;
    if (path.hasCellular) return false;
    return true;
}

/** 取得をどう扱うか */
export type AcquisitionDecision =
    /** ローカルのみで試す。ネットワークは渡さない */
    | { kind: "local" }
    /** ネットワークを許して発行する */
    | { kind: "network" }
    /** 適格な Wi-Fi を待つ。意図は保持する */
    | { kind: "waitWifi" }
    /** モバイル通信を使う可能性をユーザーに確認する */
    | { kind: "needsConsent" }
    /** 発行しない。優先軸が未選択のときの fail-closed */
    | { kind: "denied"; reason: "noPriority" | "noIntent" };

export interface AcquisitionRequest {
    /** 未選択は null。既定へ倒さない */
    priority: "save_space" | "save_data" | null;
    path: NetworkPathState;
    /** ユーザーの明示操作が今この瞬間も生きているか */
    intentActive: boolean;
    /** ローカルだけで足りるか。足りるならネットワークの話をしない */
    needsNetwork: boolean;
    /** `save_space` で、この試行についてモバイル通信の確認が取れているか */
    hasConfirmedThisAttempt: boolean;
}

/**
 * 1 回の取得について、ネットワークを許すかを決める。
 *
 * 判定順が仕様である。ローカルで足りるかを最初に見るのは、足りるなら優先軸も
 * 経路も関係ないため——参照方式でも端末にある動画は通信なしで再生できる、
 * というのがこの機能全体の前提になっている。
 */
export function decideAcquisition(
    request: AcquisitionRequest
): AcquisitionDecision {
    // 1. ローカルで足りるなら、常にローカル。優先軸が未選択でも動く。
    if (!request.needsNetwork) return { kind: "local" };

    // 2. ここから先はネットワークが要る。ユーザーの明示操作が無いものは出さない。
    //    画面を開いた・一覧をスクロールした・起動した、では取得を始めない。
    if (!request.intentActive) return { kind: "denied", reason: "noIntent" };

    // 3. 優先軸が未選択なら発行しない。既定へ倒すと、選ばせる前に方針を
    //    決めたことになる。
    if (request.priority === null) return { kind: "denied", reason: "noPriority" };

    // 4. 通信量優先。適格な Wi-Fi のときだけ出し、それ以外は待つ。
    //    待つのであって失敗ではない——端末の状態は直りうる。
    if (request.priority === "save_data") {
        return isEligibleWifiPath(request.path)
            ? { kind: "network" }
            : { kind: "waitWifi" };
    }

    // 5. 端末容量優先。Wi-Fi の制約は継承しない代わりに、その試行ごとの確認が要る。
    //    確認は 1 回の試行に閉じる。永続化すると、以後の取得の黙認になる。
    return request.hasConfirmedThisAttempt
        ? { kind: "network" }
        : { kind: "needsConsent" };
}

/**
 * ネイティブへ渡すフラグへ落とす。
 *
 * 真偽値を既定値付きで受け渡さないための出口。`network` 以外はすべて `deny`
 * であって、「省略」ではない。
 */
export function toNetworkAccess(
    decision: AcquisitionDecision
): "allow" | "deny" {
    return decision.kind === "network" ? "allow" : "deny";
}

/**
 * 取得中に経路が不適格へ変わったとき、走行中の転送を止めるか。
 *
 * 止めるのは `save_data` のネットワーク取得だけ。ローカルの転送は Wi-Fi が
 * 消えても続けてよいし、`save_space` で確認済みの転送はこの制約を継承しない
 * （#86 §12.3）。
 */
export function shouldCancelOnPathLoss(
    priority: "save_space" | "save_data" | null,
    usedNetwork: boolean,
    path: NetworkPathState
): boolean {
    if (!usedNetwork) return false;
    if (priority !== "save_data") return false;
    return !isEligibleWifiPath(path);
}
