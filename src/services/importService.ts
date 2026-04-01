import type { Asset } from "expo-media-library";
import { randomUUID } from "expo-crypto";

import { insertVideo } from "../database/repositories/videoRepository";
import { setTagsForVideo } from "../database/repositories/tagRepository";
import { generateAndSaveThumbnail } from "./thumbnailService";
import type { ImportMetadata } from "../types";

interface ImportOptions {
    /** iCloud ダウンロード後の実ファイルURI */
    sourceUri: string;
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
    const videoUri = asset.localUri ?? asset.uri ?? options.sourceUri;
    if (!videoUri) {
        throw new Error("動画ファイルのURIを解決できませんでした。");
    }
    const assetCreationTime = asset.creationTime;

    // 一意IDを生成
    const videoId = randomUUID();

    // サムネイルを生成・保存（ローカルURIで失敗した場合は sourceUri でリトライ）
    let thumbnailUri: string;
    try {
        thumbnailUri = await generateAndSaveThumbnail(videoUri, videoId);
    } catch (e) {
        if (videoUri !== options.sourceUri) {
            thumbnailUri = await generateAndSaveThumbnail(options.sourceUri, videoId);
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
