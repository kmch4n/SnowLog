/**
 * Web用スタブ — expo-media-library はブラウザ非対応のため no-op を返す
 */

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

export async function checkAssetExists(_assetId: string): Promise<boolean> {
    return false;
}
