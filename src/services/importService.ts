import type { Asset } from "expo-media-library";
import { randomUUID } from "expo-crypto";

import { insertVideo } from "../database/repositories/videoRepository";
import { setTagsForVideo } from "../database/repositories/tagRepository";
import { getAssetInfo } from "./mediaService";
import { generateAndSaveThumbnail } from "./thumbnailService";
import type { ImportMetadata } from "../types";

/**
 * 動画インポートのオーケストレーター
 *
 * 処理の流れ:
 * 1. アセット詳細情報（localUri・撮影日時）を取得
 * 2. サムネイルを生成してDocumentDirectoryに保存
 * 3. 動画レコードをDBに挿入
 * 4. タグを紐付け
 */
export async function importVideo(
    asset: Asset,
    metadata: ImportMetadata
): Promise<string> {
    // アセットの詳細情報（localUri）を取得
    const assetInfo = await getAssetInfo(asset.id);
    if (!assetInfo?.localUri) {
        throw new Error("動画ファイルのURIを取得できませんでした。");
    }

    // 一意IDを生成
    const videoId = randomUUID();

    // サムネイルを生成・保存
    const thumbnailUri = await generateAndSaveThumbnail(assetInfo.localUri, videoId);

    // 撮影日時: assetInfo.creationTime を使う（asset.creationTime はフォールバック値が混入する場合があるため）
    const capturedAt = Math.floor(assetInfo.creationTime / 1000);
    const now = Date.now();

    // DBに動画レコードを挿入
    await insertVideo({
        id: videoId,
        assetId: asset.id,
        filename: asset.filename,
        thumbnailUri,
        duration: Math.round(asset.duration),
        capturedAt,
        skiResortName: metadata.skiResortName,
        memo: metadata.memo,
        isFileAvailable: 1,
        createdAt: now,
        updatedAt: now,
    });

    // タグを紐付け
    if (metadata.tagIds.length > 0) {
        await setTagsForVideo(videoId, metadata.tagIds);
    }

    return videoId;
}
