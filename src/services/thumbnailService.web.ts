/**
 * Web用スタブ — expo-file-system / expo-video-thumbnails はブラウザ非対応
 */

export const THUMBNAIL_MISSING_SENTINEL = "";

export function resolveThumbnailUri(stored: string): string {
    return stored;
}

export function toRelativeThumbnailPath(_stored: string): string | null {
    return null;
}

export async function thumbnailFileExists(_stored: string): Promise<boolean> {
    return false;
}

export async function generateAndSaveThumbnail(
    _videoUri: string,
    _videoId: string
): Promise<string> {
    return "";
}

export async function deleteThumbnail(_stored: string): Promise<void> {
    // no-op
}
