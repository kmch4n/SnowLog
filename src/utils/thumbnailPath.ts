/**
 * サムネイルの保存パス（`thumbnails/<video-id>.jpg`）の検証
 *
 * このモジュールは import を持たない。`importPayload.ts` から相対で読まれ、
 * `scripts/tests/` が素の `tsc` でコンパイルできる必要がある（`.memory/testing.md`）。
 *
 * DB の `thumbnailUri` は、動画を消すときにそのまま `deleteThumbnail` へ渡る。
 * つまりここで通したパスは、いずれアプリが削除するパスになる。バックアップの
 * 中身は信用できないので、アプリ自身が書いたことのある形だけを通す。
 *
 * - `thumbnails/<id>.jpg` — `thumbnailService.generateAndSaveThumbnail` が書く現行形
 * - `file://…/thumbnails/<id>.jpg` — v1.1.1 より前の絶対 URI。起動時の移行が
 *   相対形に直すのと同じ規則（末尾の `thumbnails/` 以降）で相対形にする
 * - `""` — 欠損の番兵（`THUMBNAIL_MISSING_SENTINEL`）
 *
 * ファイル名が所有する動画の ID そのものであることを要求する。そうしないと、
 * ある行を消したときに別の動画のサムネイルが消える。
 */

/** サムネイルを置くディレクトリ。末尾のスラッシュを含む */
export const THUMBNAIL_DIRECTORY = "thumbnails/";

/** `thumbnailService.THUMBNAIL_MISSING_SENTINEL` と同じ値 */
const MISSING_SENTINEL = "";

/** 旧形式の絶対 URI が持っていたスキーム */
const LEGACY_ABSOLUTE_SCHEME = "file://";

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

/**
 * バックアップから読んだ `thumbnailUri` を、この動画が所有する相対パスか番兵に直す。
 *
 * 不正な値で行ごと捨てることはしない。動画のメタデータは復元する価値があり、
 * サムネイルは欠損として扱えば済む。
 */
export function normalizeRestoredThumbnailPath(stored: string, videoId: string): string {
    let relative: string;
    if (stored.startsWith(THUMBNAIL_DIRECTORY)) {
        relative = stored;
    } else if (stored.startsWith(LEGACY_ABSOLUTE_SCHEME)) {
        const marker = `/${THUMBNAIL_DIRECTORY}`;
        const index = stored.lastIndexOf(marker);
        if (index === -1) return MISSING_SENTINEL;
        relative = stored.slice(index + 1);
    } else {
        return MISSING_SENTINEL;
    }

    if (!isSafeThumbnailPath(relative)) return MISSING_SENTINEL;
    if (relative !== `${THUMBNAIL_DIRECTORY}${videoId}.jpg`) return MISSING_SENTINEL;
    return relative;
}
