/**
 * Synthetic assetId の生成と判定
 *
 * このモジュールは import を持たない。`scripts/tests/assetId.test.cjs` が
 * 素の `tsc <file>` でコンパイルして require するため、import を 1 つでも足すと
 * emit が `out/utils/` にネストしてテストが壊れる。詳細は `.memory/testing.md`。
 *
 * 判定側は `mediaService` / `mediaService.web` の両方から re-export される。
 * ネイティブとしか対応していなかった頃、Web シムがこの関数だけ落としていて
 * 動画削除が `TypeError` で落ちていた（Issue #71）。プレフィックスをここに
 * 一本化しているのは、その再発と、生成側 / 判定側の食い違いを防ぐため。
 */

/** Synthetic assetId の接頭辞。MediaLibrary に対応するアセットが無いことを示す */
export const SYNTHETIC_ASSET_ID_PREFIX = "synthetic:";

/** Check whether an assetId is a synthetic placeholder (no MediaLibrary entry) */
export function isSyntheticAssetId(assetId: string): boolean {
    return assetId.startsWith(SYNTHETIC_ASSET_ID_PREFIX);
}
