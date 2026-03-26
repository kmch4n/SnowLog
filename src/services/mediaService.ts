import * as MediaLibrary from "expo-media-library";

/**
 * expo-media-library のラッパー
 * フォトライブラリへのアクセス・動画取得を担う
 */

/** フォトライブラリの権限を要求する */
export async function requestMediaPermissions(): Promise<boolean> {
    try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        return status === "granted";
    } catch {
        return false;
    }
}

/** 現在の権限状態を確認する */
export async function checkMediaPermissions(): Promise<boolean> {
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status === "granted";
}

/**
 * カメラロールから動画アセット一覧を取得する
 * @param after ページネーション用カーソル
 * @param first 取得件数（デフォルト: 50）
 */
export async function getVideoAssets(
    after?: string,
    first = 50
): Promise<MediaLibrary.PagedInfo<MediaLibrary.Asset>> {
    return MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.video,
        sortBy: MediaLibrary.SortBy.creationTime,
        first,
        after,
    });
}

/**
 * アセットIDから詳細情報を取得する
 * - localUri: 動画本体のファイルURI
 * - creationTime: 撮影日時（Unix timestamp ミリ秒）
 * - duration: 再生時間（秒）
 */
export async function getAssetInfo(
    assetId: string
): Promise<MediaLibrary.AssetInfo | null> {
    try {
        return await MediaLibrary.getAssetInfoAsync(assetId);
    } catch {
        return null;
    }
}

/**
 * アセットIDの動画が今もフォトライブラリに存在するか確認する
 * 元ファイルが削除されていた場合 false を返す
 */
export async function checkAssetExists(assetId: string): Promise<boolean> {
    try {
        const info = await MediaLibrary.getAssetInfoAsync(assetId);
        return info !== null && info.localUri !== undefined;
    } catch {
        return false;
    }
}
