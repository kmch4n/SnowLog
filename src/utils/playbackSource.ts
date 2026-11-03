/**
 * 動画の再生元を解決した結果から、何を表示し `isFileAvailable` をどう書くかを決める（#87）
 *
 * 以前は解決できなければ権限に関係なく `isFileAvailable = 0`（ファイル無し）を書き、
 * しかも 0 の行は二度と解決を試みなかった。そのため「選択した写真のみ」の間に開いただけの
 * 動画が、フルアクセスに戻しても永久に「ファイル無し」のままになった。
 *
 * 規則:
 * - 解決できたら再生する。行が 0 なら 1 に戻す（戻すのは解決に成功したときだけ）。
 * - 解決できず、写真へのフルアクセスがあるなら、本当に無いので 0 にする。
 * - 解決できず、アクセスが限定か無しなら、権限の問題であってファイル欠損ではない。
 *   何も書かず、アクセスの案内を出す。
 *
 * アプリ内コピー（`copy`）は写真ライブラリを見ないので、呼び出し側は `access: "all"` を渡す。
 *
 * import を持たない。`scripts/tests/` が素の `tsc` でコンパイルできるようにするため。
 */

/** 写真ライブラリへのアクセス。expo-media-library の `accessPrivileges` に対応する */
export type PhotosAccess = "all" | "limited" | "none";

export type PlaybackSourceDecision =
    /** 再生する。`markAvailable` なら `isFileAvailable` を 1 に戻す */
    | { kind: "play"; markAvailable: boolean }
    /** ファイルが本当に無い。`markMissing` なら `isFileAvailable` を 0 にする */
    | { kind: "missing"; markMissing: boolean }
    /** 権限が足りないだけ。何も書かず、写真へのアクセスを案内する */
    | { kind: "notAccessible" };

export function decidePlaybackSource(input: {
    resolved: boolean;
    access: PhotosAccess;
    /** いま DB に入っている `isFileAvailable === 1` */
    wasAvailable: boolean;
}): PlaybackSourceDecision {
    if (input.resolved) {
        return { kind: "play", markAvailable: !input.wasAvailable };
    }
    if (input.access !== "all") {
        return { kind: "notAccessible" };
    }
    return { kind: "missing", markMissing: input.wasAvailable };
}
