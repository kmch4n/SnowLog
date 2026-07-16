/**
 * iOS Photos フレームワーク由来のエラー判定
 *
 * このモジュールは import を持たない。`scripts/tests/photosErrors.test.cjs` が
 * 素の `tsc <file>` でコンパイルして require するため、import を 1 つでも足すと
 * emit が `out/utils/` にネストしてテストが壊れる。詳細は `.memory/testing.md`。
 */

const PHOTOS_ERROR_DOMAIN = "PHPhotosErrorDomain";

/**
 * エラーが iOS Photos フレームワーク由来かどうかを判定する。
 *
 * エラーコードの番号ではなくドメイン名で判定する。iCloud にのみ存在する動画を
 * 取得できないときのコードは 3163 と 3164 の両方が観測されており、番号を 1 つに
 * 決め打ちしたことが「iCloud 動画をインポートできない」不具合そのものだった
 * （再試行が発火せず、picker が生のエラーコードを表示していた）。
 *
 * 見逃すとユーザーに見える失敗になる一方、広く拾いすぎたときの代償は
 * 同じ結果に終わる取得の再試行と、案内文が iCloud 寄りになることだけなので、
 * 番号を列挙して未知のコードを取りこぼすより安全側に倒している。
 */
export function isPhotosLibraryError(error: unknown): boolean {
    if (typeof error === "string") {
        return error.includes(PHOTOS_ERROR_DOMAIN);
    }

    if (typeof error !== "object" || error === null) {
        return false;
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.includes(PHOTOS_ERROR_DOMAIN)) {
        return true;
    }

    const code = (error as { code?: unknown }).code;
    return code === PHOTOS_ERROR_DOMAIN || code === "E_PHOTOS_ERROR";
}
