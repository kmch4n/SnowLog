import type { Asset } from "expo-media-library";
import { randomUUID } from "expo-crypto";

import { insertVideo } from "../database/repositories/videoRepository";
import { setTagsForVideo } from "../database/repositories/tagRepository";
import { generateAndSaveThumbnail } from "./thumbnailService";
import type { ImportMetadata } from "../types";

interface ImportOptions {
    /** expo-image-picker から取得した一時URI（MediaLibrary が使えない場合のフォールバック） */
    pickerUri: string;
}

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
    metadata: ImportMetadata,
    options: ImportOptions
): Promise<string> {
    // expo-image-picker の pickerUri を直接使用する。
    // MediaLibrary.getAssetInfoAsync は iCloud 動画で PHPhotosErrorNetworkAccessRequired を
    // 発生させるため、インポートフローでは呼び出さない。
    const videoUri = options.pickerUri;
    const assetCreationTime = asset.creationTime;

    // 一意IDを生成
    const videoId = randomUUID();

    // サムネイルを生成・保存（localUri で失敗した場合は pickerUri でリトライ）
    let thumbnailUri: string;
    try {
        thumbnailUri = await generateAndSaveThumbnail(videoUri, videoId);
    } catch (e) {
        if (videoUri !== options.pickerUri) {
            thumbnailUri = await generateAndSaveThumbnail(options.pickerUri, videoId);
        } else {
            throw e;
        }
    }

    const capturedAt = Number.isFinite(assetCreationTime)
        ? Math.floor(assetCreationTime / 1000)
        : Math.floor(Date.now() / 1000);
    const now = Date.now();

    // DBに動画レコードを挿入
    await insertVideo({
        id: videoId,
        assetId: asset.id,
        filename: asset.filename,
        thumbnailUri,
        duration: Math.round(asset.duration),
        capturedAt,
        title: metadata.title || null,
        skiResortName: metadata.skiResortName,
        memo: metadata.memo,
        techniques: metadata.techniques.length > 0 ? JSON.stringify(metadata.techniques) : null,
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
