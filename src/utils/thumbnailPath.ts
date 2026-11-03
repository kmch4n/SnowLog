/**
 * サムネイルの保存パス（`thumbnails/<video-id>.jpg`）の検証
 *
 * このモジュールは import を持たない。`scripts/tests/` が素の `tsc` でコンパイルできる
 * 必要がある（`.memory/testing.md`）。
 *
 * DB の `thumbnailUri` は、動画を消すときにそのまま `deleteThumbnail` へ渡る。
 * 削除してよいのはサムネイルディレクトリ直下の、アプリ自身が書く形のファイルだけにする。
 */

/** サムネイルを置くディレクトリ。末尾のスラッシュを含む */
export const THUMBNAIL_DIRECTORY = "thumbnails/";

/**
 * サムネイルディレクトリ直下のファイル名として安全か。区切り文字・`..`・
 * 余分なドットを含むものを弾く。拡張子はアプリが書いてきた `jpg` のみ。
 */
const SAFE_THUMBNAIL_FILENAME = /^[A-Za-z0-9_-]+\.jpg$/;

/**
 * 相対パスがサムネイルディレクトリ直下の安全なファイルを指すか。
 * 所有者の ID は見ない（削除側のガード用）。
 */
export function isSafeThumbnailPath(relativePath: string): boolean {
    if (!relativePath.startsWith(THUMBNAIL_DIRECTORY)) return false;
    return SAFE_THUMBNAIL_FILENAME.test(relativePath.slice(THUMBNAIL_DIRECTORY.length));
}
