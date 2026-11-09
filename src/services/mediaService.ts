import * as MediaLibrary from "expo-media-library";

import type { PhotosAccess } from "../utils/playbackSource";
import { isPhotosLibraryError } from "../utils/photosErrors";

// Re-exported so callers keep importing it from here; the implementation lives
// in utils/ so mediaService.web.ts can expose the same binding (Issue #71).
export { isSyntheticAssetId } from "../utils/assetId";

/**
 * expo-media-library のラッパー
 * フォトライブラリへのアクセス・動画取得を担う
 */

/**
 * 写真ライブラリへのアクセスを要求し、得られた範囲を返す
 *
 * 「許可されたか」だけでは「選択した写真のみ」（limited）を区別できず、許可範囲外の
 * 動画が解決できないことと、本当に消えていることを取り違える（#87）。
 */
export async function requestPhotosAccess(): Promise<PhotosAccess> {
    try {
        const { status, accessPrivileges } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") return "none";
        return accessPrivileges === "limited" ? "limited" : "all";
    } catch {
        return "none";
    }
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
 * 写真ライブラリでアセットを探した結果
 *
 * ネイティブはアセットが見つからないと例外ではなく null を返す（「選択した写真のみ」の範囲外も
 * これになる）。取得そのものの失敗（例外）とは分けて扱う。
 */
export type AssetLookup =
    | { status: "found"; info: MediaLibrary.AssetInfo }
    | { status: "notFound" }
    | { status: "failed" };

function toLookup(info: MediaLibrary.AssetInfo | null): AssetLookup {
    return info ? { status: "found", info } : { status: "notFound" };
}

/**
 * iCloud 動画にも対応するアセット検索（自動ダウンロードリトライ付き）
 * まず shouldDownloadFromNetwork: false で試み、Photos 由来のエラーなら
 * true でリトライする。ユーザー操作起点の箇所（インポート・詳細画面）で使用する。
 */
export async function lookupAssetWithDownload(assetId: string): Promise<AssetLookup> {
    try {
        return toLookup(
            await MediaLibrary.getAssetInfoAsync(assetId, {
                shouldDownloadFromNetwork: false,
            })
        );
    } catch (error) {
        if (!isPhotosLibraryError(error)) {
            return { status: "failed" };
        }
    }
    try {
        return toLookup(
            await MediaLibrary.getAssetInfoAsync(assetId, {
                shouldDownloadFromNetwork: true,
            })
        );
    } catch {
        return { status: "failed" };
    }
}

/** `lookupAssetWithDownload` の情報だけを返す版。見つからない・失敗はどちらも null */
export async function getAssetInfoWithDownload(
    assetId: string
): Promise<MediaLibrary.AssetInfo | null> {
    const lookup = await lookupAssetWithDownload(assetId);
    return lookup.status === "found" ? lookup.info : null;
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
