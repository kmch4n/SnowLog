import * as MediaLibrary from "expo-media-library";

import { isPhotosLibraryError } from "../utils/photosErrors";

// Re-exported so callers keep importing it from here; the implementation lives
// in utils/ so mediaService.web.ts can expose the same binding (Issue #71).
export { isSyntheticAssetId } from "../utils/assetId";

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
    assetId: string,
    options?: { shouldDownloadFromNetwork?: boolean }
): Promise<MediaLibrary.AssetInfo | null> {
    try {
        return await MediaLibrary.getAssetInfoAsync(assetId, options);
    } catch {
        // iCloud 専用アセット等のネイティブエラーを握りつぶす
        return null;
    }
}

/**
 * iCloud 動画にも対応するアセット情報取得（自動ダウンロードリトライ付き）
 * まず shouldDownloadFromNetwork: false で試み、Photos 由来のエラーなら
 * true でリトライする。ユーザー操作起点の箇所（インポート・詳細画面）で使用する。
 */
export async function getAssetInfoWithDownload(
    assetId: string
): Promise<MediaLibrary.AssetInfo | null> {
    try {
        return await MediaLibrary.getAssetInfoAsync(assetId, {
            shouldDownloadFromNetwork: false,
        });
    } catch (error) {
        if (!isPhotosLibraryError(error)) {
            return null;
        }
    }
    try {
        return await MediaLibrary.getAssetInfoAsync(assetId, {
            shouldDownloadFromNetwork: true,
        });
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
        const info = await MediaLibrary.getAssetInfoAsync(assetId, {
            shouldDownloadFromNetwork: false,
        });
        return info !== null && info.localUri !== undefined;
    } catch {
        return false;
    }
}
