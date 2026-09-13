import { randomUUID } from "expo-crypto";

import { deleteVideo, insertVideo } from "../database/repositories/videoRepository";
import { setTagsForVideo } from "../database/repositories/tagRepository";
import { getCurrentLocale, t } from "../i18n";
import {
    deleteManagedPath,
    getManagedVideoFileUri,
    persistManagedVideoFile,
} from "./managedVideoFileService";
import { buildManagedVideoPath } from "../utils/managedVideoPath";
import { isSyntheticAssetId } from "./mediaService";
import { protectFilesFromOrphanedCleanup } from "./orphanedFileCleanupService";
import {
    deleteThumbnail,
    generateAndSaveThumbnail,
    getThumbnailDirectoryUri,
} from "./thumbnailService";
import type { ImportMetadata } from "../types";
import { formatDateTime } from "../utils/dateUtils";

interface ImportOptions {
    sourceUri: string;
}

export interface ImportableAsset {
    id: string;
    filename: string;
    uri: string;
    creationTime: number;
    duration: number;
    localUri?: string | null;
}

export async function importVideo(
    asset: ImportableAsset,
    metadata: ImportMetadata,
    options: ImportOptions
): Promise<string> {
    let videoUri = asset.localUri ?? asset.uri ?? options.sourceUri;
    if (!videoUri) {
        throw new Error(t("errors.importFailed"));
    }

    const assetCreationTime = asset.creationTime;
    // 取り込み元に写真ライブラリ上の身元が無いものだけがコピーになる。この段階では
    // 保存方式はまだユーザーが選べないので、身元と保存方式は一致したままでよい。
    // 一致しなくなるのは方式選択が入ってから（#86 §5）。
    const isSyntheticImport = isSyntheticAssetId(asset.id);
    const videoId = randomUUID();
    const managedVideoPath = isSyntheticImport
        ? buildManagedVideoPath(videoId, asset.filename)
        : null;
    const protectedFileUris = [`${getThumbnailDirectoryUri()}${videoId}.jpg`];

    if (isSyntheticImport) {
        protectedFileUris.push(getManagedVideoFileUri(videoId, asset.filename, videoUri));
    }

    const releaseCleanupProtection = protectFilesFromOrphanedCleanup(protectedFileUris);

    try {
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
                title: metadata.title || formatDateTime(capturedAt, getCurrentLocale()),
                skiResortName: metadata.skiResortName,
                memo: metadata.memo,
                techniques: metadata.techniques.length > 0 ? JSON.stringify(metadata.techniques) : null,
                isFileAvailable: 1,
                // 列の既定値に頼らず明示的に書く。既定は `reference` なので、
                // 頼ると synthetic の取り込みが参照方式として記録されてしまう。
                storageMode: isSyntheticImport ? "copy" : "reference",
                managedVideoPath,
                createdAt: now,
                updatedAt: now,
            });

            if (metadata.tagIds.length > 0) {
                await setTagsForVideo(videoId, metadata.tagIds);
            }
        } catch (error) {
            await deleteVideo(videoId).catch(() => {});
            await deleteThumbnail(thumbnailUri).catch(() => {});
            if (managedVideoPath) {
                await deleteManagedPath(managedVideoPath).catch(() => {});
            }
            throw error;
        }

        return videoId;
    } finally {
        releaseCleanupProtection();
    }
}
