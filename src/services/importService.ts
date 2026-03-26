import type { Asset } from "expo-media-library";
import { randomUUID } from "expo-crypto";

import { insertVideo } from "../database/repositories/videoRepository";
import { setTagsForVideo } from "../database/repositories/tagRepository";
import { getAssetInfo, requestMediaPermissions } from "./mediaService";
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
    // MediaLibrary の権限を確認（getAssetInfo で localUri を取得するために必要）
    const permResult = await requestMediaPermissions();

    // アセットの詳細情報（localUri）を取得
    let videoUri = options.pickerUri;
    let assetCreationTime = asset.creationTime;

    if (permResult) {
        const assetInfo = await getAssetInfo(asset.id);
        if (assetInfo?.localUri) {
            // expo-media-library が返す localUri のフラグメント（#...）を除去
            videoUri = assetInfo.localUri.split("#")[0];
            assetCreationTime = assetInfo.creationTime;
        }
    }

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

    const capturedAt = Math.floor(assetCreationTime / 1000);
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
