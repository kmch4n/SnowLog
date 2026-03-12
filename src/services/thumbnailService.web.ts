/**
 * Web用スタブ — expo-file-system / expo-video-thumbnails はブラウザ非対応
 */

export async function generateAndSaveThumbnail(
    _videoUri: string,
    _videoId: string
): Promise<string> {
    return "";
}

export async function deleteThumbnail(_thumbnailUri: string): Promise<void> {
    // no-op
}
