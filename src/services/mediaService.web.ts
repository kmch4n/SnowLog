/**
 * Web用スタブ — expo-media-library はブラウザ非対応のため no-op を返す
 *
 * ネイティブ側の `mediaService.ts` が export するものをすべて揃えること。
 * `isSyntheticAssetId` が欠けていた頃、`useVideoDetail` と
 * `videoDeletionService`（どちらも `.web` を持たない）が Web で undefined を
 * 呼び出し、動画削除が `TypeError` で落ちていた（Issue #71）。
 */

// ネイティブ非依存の純粋関数なので、ネイティブと同じ実装をそのまま共有する
export { isSyntheticAssetId } from "../utils/assetId";

export async function requestMediaPermissions(): Promise<boolean> {
    return false;
}

export async function checkMediaPermissions(): Promise<boolean> {
    return false;
}

export async function getVideoAssets(): Promise<{ assets: never[]; hasNextPage: boolean; endCursor: string; totalCount: number }> {
    return { assets: [], hasNextPage: false, endCursor: "", totalCount: 0 };
}

export async function getAssetInfo(_assetId: string): Promise<null> {
    return null;
}

export async function getAssetInfoWithDownload(_assetId: string): Promise<null> {
    return null;
}

export async function checkAssetExists(_assetId: string): Promise<boolean> {
    return false;
}
