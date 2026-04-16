import * as FileSystem from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";

/**
 * Thumbnails are stored as RELATIVE paths in the database (e.g. `thumbnails/<id>.jpg`)
 * and resolved against the current `FileSystem.documentDirectory` at read time.
 *
 * Why: iOS can relocate the app container on updates, which changes the UUID in
 * the absolute path. Persisting absolute paths makes stored URIs stale after
 * updates. Relative paths are rebased against the current container on every
 * launch, so they remain valid across relocations.
 *
 * A thumbnailUri of `""` is a sentinel meaning "permanently missing" — used
 * after the startup migration confirms the file is gone and cannot be
 * regenerated.
 */
const THUMBNAIL_RELATIVE_DIR = "thumbnails/";
const THUMBNAIL_ABSOLUTE_DIR = `${FileSystem.documentDirectory}${THUMBNAIL_RELATIVE_DIR}`;

/** Sentinel stored in the DB when a thumbnail is confirmed missing and unrecoverable. */
export const THUMBNAIL_MISSING_SENTINEL = "";

/** サムネイルディレクトリが存在しない場合は作成する */
async function ensureThumbnailDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(THUMBNAIL_ABSOLUTE_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(THUMBNAIL_ABSOLUTE_DIR, { intermediates: true });
    }
}

/**
 * Build the relative path for a given video ID.
 * The returned value is safe to persist in the database.
 */
function buildRelativeThumbnailPath(videoId: string): string {
    return `${THUMBNAIL_RELATIVE_DIR}${videoId}.jpg`;
}

/**
 * Convert a stored thumbnailUri into an absolute `file://` URI for display.
 *
 * Accepts three input shapes for backwards compatibility:
 *   - Relative path (`thumbnails/<id>.jpg`)          → prepended with documentDirectory
 *   - Legacy absolute path (`file://.../thumbnails/<id>.jpg`) → converted by extracting the tail
 *   - Sentinel empty string                          → returned as-is (caller must handle)
 */
export function resolveThumbnailUri(stored: string): string {
    if (stored === THUMBNAIL_MISSING_SENTINEL) return stored;

    // Already a relative path in the expected form
    if (stored.startsWith(THUMBNAIL_RELATIVE_DIR)) {
        return `${FileSystem.documentDirectory}${stored}`;
    }

    // Legacy absolute path — rebase against current container
    const relative = toRelativeThumbnailPath(stored);
    if (relative) {
        return `${FileSystem.documentDirectory}${relative}`;
    }

    // Unknown format — return as-is so callers see the problem instead of silently broken
    return stored;
}

/**
 * Convert any stored thumbnailUri into the canonical relative form.
 * Returns null if the input does not look like a thumbnail path we manage.
 *
 * Used by the startup migration to normalise legacy absolute paths.
 */
export function toRelativeThumbnailPath(stored: string): string | null {
    if (!stored) return null;
    if (stored.startsWith(THUMBNAIL_RELATIVE_DIR)) return stored;

    const marker = `/${THUMBNAIL_RELATIVE_DIR}`;
    const idx = stored.lastIndexOf(marker);
    if (idx === -1) return null;

    const tail = stored.slice(idx + 1); // drop the leading `/`
    return tail.startsWith(THUMBNAIL_RELATIVE_DIR) ? tail : null;
}

/** Check whether the thumbnail file referenced by a stored URI actually exists on disk. */
export async function thumbnailFileExists(stored: string): Promise<boolean> {
    if (stored === THUMBNAIL_MISSING_SENTINEL) return false;
    const absolute = resolveThumbnailUri(stored);
    if (absolute === THUMBNAIL_MISSING_SENTINEL) return false;
    const info = await FileSystem.getInfoAsync(absolute);
    return info.exists;
}

/**
 * 動画のサムネイル画像を生成してアプリのストレージに保存する
 * @param videoUri expo-media-library から取得した動画の localUri
 * @param videoId  動画の一意ID（ファイル名に使用）
 * @returns 保存したサムネイルの相対パス（DB 格納用）
 */
export async function generateAndSaveThumbnail(
    videoUri: string,
    videoId: string
): Promise<string> {
    await ensureThumbnailDir();

    // 動画の先頭フレーム（0秒）をサムネイルとして取得
    const { uri: tempUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 0,
        quality: 0.7,
    });

    // アプリのドキュメントディレクトリに恒久保存
    const relativePath = buildRelativeThumbnailPath(videoId);
    const destAbsolute = `${FileSystem.documentDirectory}${relativePath}`;
    // If a stale file already exists (e.g. partial generation), replace it.
    await FileSystem.deleteAsync(destAbsolute, { idempotent: true }).catch(() => {});
    await FileSystem.moveAsync({ from: tempUri, to: destAbsolute });

    return relativePath;
}

/**
 * サムネイルファイルを削除する
 * @param stored DB に保存されたサムネイル URI（相対 or 絶対）
 */
export async function deleteThumbnail(stored: string): Promise<void> {
    if (stored === THUMBNAIL_MISSING_SENTINEL) return;
    const absolute = resolveThumbnailUri(stored);
    if (absolute === THUMBNAIL_MISSING_SENTINEL) return;
    const info = await FileSystem.getInfoAsync(absolute);
    if (info.exists) {
        await FileSystem.deleteAsync(absolute);
    }
}
