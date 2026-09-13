/**
 * 動画の保存方式（`videos.storage_mode`）の型と正規化
 *
 * このモジュールは import を持たない。`scripts/tests/videoStorageMode.test.cjs`
 * が素の `tsc <file>` でコンパイルして require するため。`utils/assetId.ts` と
 * 同じ制約。詳細は `.memory/testing.md`。
 *
 * `src/types/index.ts` はここから型だけを再エクスポートする。型の正典を
 * types 側に置くと、この 2 つの述語が types を import することになり、
 * 単独コンパイルできなくなる。
 */

/**
 * 動画の保存方式
 * - `reference`: 写真ライブラリを参照する。アプリ側にバイトを持たない
 * - `copy`: アプリ管理下にファイルを持つ。`managedVideoPath` が実体を指す
 */
export type VideoStorageMode = "reference" | "copy";

/** 有効な保存方式の全体。復元時の検証とテストが列挙に使う */
export const VIDEO_STORAGE_MODES: readonly VideoStorageMode[] = [
    "reference",
    "copy",
];

/** 値が保存方式として妥当か判定する */
export function isVideoStorageMode(value: unknown): value is VideoStorageMode {
    return value === "reference" || value === "copy";
}

/**
 * DB やバックアップから来た値を保存方式へ正規化する。
 *
 * 未知の値は `reference` に倒す。`copy` に倒すと、アプリが持っていないファイルを
 * 所有していると主張することになり、再生で存在しないパスを掴む。`reference` なら
 * 最悪でも「写真ライブラリに見つからない」という既存の失敗経路に落ちるだけで、
 * どちらに転んでもデータは失われない。
 *
 * 復元経路では正規化ではなく**拒否**が要る場面がある（#86 §8）。そちらは
 * `isVideoStorageMode` を直接使って行ごとにスキップすること。
 */
export function normalizeVideoStorageMode(value: unknown): VideoStorageMode {
    return isVideoStorageMode(value) ? value : "reference";
}
