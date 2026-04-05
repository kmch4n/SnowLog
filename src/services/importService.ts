import type { Asset } from "expo-media-library";
import { randomUUID } from "expo-crypto";

import { insertVideo } from "../database/repositories/videoRepository";
import { setTagsForVideo } from "../database/repositories/tagRepository";
import {
    deleteManagedVideoFile,
    persistManagedVideoFile,
} from "./managedVideoFileService";
import { isSyntheticAssetId } from "./mediaService";
import { deleteThumbnail, generateAndSaveThumbnail } from "./thumbnailService";
import type { ImportMetadata } from "../types";
import { formatDateTime } from "../utils/dateUtils";

interface ImportOptions {
    sourceUri: string;
}

type ImportableAsset = Asset & {
    localUri?: string | null;
};

export async function importVideo(
    asset: ImportableAsset,
    metadata: ImportMetadata,
    options: ImportOptions
): Promise<string> {
    let videoUri = asset.localUri ?? asset.uri ?? options.sourceUri;
    if (!videoUri) {
        throw new Error("動画ファイルのURIを取得できませんでした。");
    }

    const assetCreationTime = asset.creationTime;
    const isSyntheticImport = isSyntheticAssetId(asset.id);
    const videoId = randomUUID();

    if (isSyntheticImport) {
        videoUri = await persistManagedVideoFile(videoUri, videoId, asset.filename);
    }

    let thumbnailUri: string;
    try {
        thumbnailUri = await generateAndSaveThumbnail(videoUri, videoId);
    } catch (error) {
        if (videoUri !== options.sourceUri) {
            thumbnailUri = await generateAndSaveThumbnail(options.sourceUri, videoId);
        } else {
            throw error;
        }
    }

    const capturedAt = Number.isFinite(assetCreationTime)
        ? Math.floor(assetCreationTime / 1000)
        : Math.floor(Date.now() / 1000);
    const now = Math.floor(Date.now() / 1000);

    try {
        await insertVideo({
            id: videoId,
            assetId: asset.id,
            filename: asset.filename,
            thumbnailUri,
            duration: Math.round(asset.duration),
            capturedAt,
            title: metadata.title || formatDateTime(capturedAt),
            skiResortName: metadata.skiResortName,
            memo: metadata.memo,
            techniques: metadata.techniques.length > 0 ? JSON.stringify(metadata.techniques) : null,
            isFileAvailable: 1,
            createdAt: now,
            updatedAt: now,
        });

        if (metadata.tagIds.length > 0) {
            await setTagsForVideo(videoId, metadata.tagIds);
        }
    } catch (error) {
        await deleteThumbnail(thumbnailUri).catch(() => {});
        if (isSyntheticImport) {
            await deleteManagedVideoFile(videoId, asset.filename).catch(() => {});
        }
        throw error;
    }

    return videoId;
}
