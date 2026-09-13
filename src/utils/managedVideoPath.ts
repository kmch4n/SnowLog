/**
 * アプリ管理下の動画ファイルの相対パス（`videos/<video-id>.<ext>`）の生成と検証
 *
 * このモジュールは import を持たない。`scripts/tests/managedVideoPath.test.cjs`
 * が素の `tsc <file>` でコンパイルして require するため、import を 1 つでも足すと
 * emit が `out/utils/` にネストしてテストが壊れる。`utils/assetId.ts` と同じ制約。
 * 詳細は `.memory/testing.md`。
 *
 * パスを相対で持つのは iOS がアプリコンテナを再配置するため。絶対 URI を DB に
 * 保存すると OS アップデートやバックアップ復元後に解決できなくなる。絶対 URI へ
 * の変換は `managedVideoFileService.managedPathToUri` が担う。
 *
 * ファイル名（basename）が動画 ID そのものであることが所有権の担保になっている。
 * ある行が別の行のファイルを指すことは、この規約の下では表現できない。
 */

/** 管理下動画を置くディレクトリ。末尾のスラッシュを含む */
export const MANAGED_VIDEO_DIRECTORY = "videos/";

/** 拡張子が無い、または読み取れないときの既定値 */
const DEFAULT_EXTENSION = "mov";

/**
 * 動画 ID として安全か。`randomUUID()` 由来の ID を通し、パス区切りや `..`、
 * ドットを含むものを弾く。復元されたバックアップの ID は信用できないため、
 * ファイル名に使う前に必ずここを通す。
 */
const SAFE_VIDEO_ID = /^[A-Za-z0-9_-]+$/;

/** 拡張子として許す文字。英数字のみ */
const SAFE_EXTENSION = /^[A-Za-z0-9]+$/;

/**
 * `managedVideoFileService.inferExtension` と同一の規則。
 *
 * 先頭からの最初の「末尾またはクエリが続くドット区切り」を拡張子とみなす。
 * `my.video.mp4` が `video` ではなく `mp4` になるのはこのため。既存の
 * managed ファイルはこの規則で命名されているので、ここがずれると移行が
 * 実在しないパスを指す。
 */
const EXTENSION_FROM_NAME = /\.([a-zA-Z0-9]+)(?:$|\?)/;

/** 動画 ID がファイル名として安全か判定する */
export function isSafeVideoId(videoId: string): boolean {
    return SAFE_VIDEO_ID.test(videoId);
}

/** ファイル名から拡張子を推定する。読み取れなければ `mov` */
export function inferManagedExtension(filename: string | null): string {
    const match = (filename ?? "").match(EXTENSION_FROM_NAME);
    return match ? match[1].toLowerCase() : DEFAULT_EXTENSION;
}

/**
 * 既存の命名規約どおりの相対パスを組み立てる。
 * ID が安全でなければ null を返す（呼び出し側は「パス無しの copy 行」として扱う）
 */
export function buildManagedVideoPath(
    videoId: string,
    filename: string | null
): string | null {
    if (!isSafeVideoId(videoId)) return null;
    return `${MANAGED_VIDEO_DIRECTORY}${videoId}.${inferManagedExtension(filename)}`;
}

/**
 * 相対パスが「この動画 ID が所有するファイル」として妥当か検証する。
 *
 * 拡張子は英数字なら何でも通す。新規出力を `mov|mp4|m4v` に絞るのは書き込み側
 * （#86 Task D）の責務で、ここで絞ると既存の legacy ファイルが孤児になる
 * （#86 §5）。後から「厳しくする」変更を入れないこと。
 */
export function validateManagedVideoPath(
    relativePath: string,
    videoId: string
): boolean {
    if (!isSafeVideoId(videoId)) return false;
    if (!relativePath.startsWith(MANAGED_VIDEO_DIRECTORY)) return false;

    const basename = relativePath.slice(MANAGED_VIDEO_DIRECTORY.length);
    const separator = basename.indexOf(".");
    if (separator <= 0) return false;

    const stem = basename.slice(0, separator);
    const extension = basename.slice(separator + 1);

    if (stem !== videoId) return false;
    return SAFE_EXTENSION.test(extension);
}
