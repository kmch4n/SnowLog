import * as FileSystem from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";

// サムネイルの保存先ディレクトリ
const THUMBNAIL_DIR = `${FileSystem.documentDirectory}thumbnails/`;

/** サムネイルディレクトリが存在しない場合は作成する */
async function ensureThumbnailDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(THUMBNAIL_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(THUMBNAIL_DIR, { intermediates: true });
    }
}

/**
 * 動画のサムネイル画像を生成してアプリのストレージに保存する
 * @param videoUri expo-media-library から取得した動画の localUri
 * @param videoId  動画の一意ID（ファイル名に使用）
 * @returns 保存したサムネイルのローカルURI
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
    const destUri = `${THUMBNAIL_DIR}${videoId}.jpg`;
    await FileSystem.moveAsync({ from: tempUri, to: destUri });

    return destUri;
}

/**
 * サムネイルファイルを削除する
 * @param thumbnailUri 削除するサムネイルのURI
 */
export async function deleteThumbnail(thumbnailUri: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(thumbnailUri);
    if (info.exists) {
        await FileSystem.deleteAsync(thumbnailUri);
    }
}
