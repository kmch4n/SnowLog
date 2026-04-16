import {
    getPreference,
    setPreference,
} from "@/database/repositories/appPreferenceRepository";
import {
    getAllVideos,
    updateVideoThumbnailUri,
} from "@/database/repositories/videoRepository";
import { resolveManagedVideoFileUri } from "./managedVideoFileService";
import { getAssetInfo, isSyntheticAssetId } from "./mediaService";
import {
    THUMBNAIL_MISSING_SENTINEL,
    generateAndSaveThumbnail,
    thumbnailFileExists,
    toRelativeThumbnailPath,
} from "./thumbnailService";

/**
 * Thumbnail path/existence migration — runs once per app update.
 *
 * Why: Before v1.1.1 thumbnails were stored as absolute paths containing the
 * iOS app container UUID. iOS can relocate the container on app updates,
 * which invalidates those absolute paths. This migration:
 *   1. Normalises any stored thumbnailUri to the current relative form
 *      (`thumbnails/<id>.jpg`).
 *   2. Verifies the thumbnail file actually exists at the expected location.
 *   3. Regenerates the thumbnail from the source video when missing.
 *   4. Marks the thumbnail as permanently missing (empty-string sentinel)
 *      when the source video cannot be located either.
 *
 * The migration is gated by `thumbnail_migration_version` in app_preferences
 * so it only runs the first time a user launches a new version.
 */
const PREFERENCE_KEY = "thumbnail_migration_version";
const CURRENT_VERSION = "1";

export interface MigrationProgress {
    processed: number;
    total: number;
}

/** Returns true if the migration has not yet run for the current version. */
export async function isThumbnailMigrationNeeded(): Promise<boolean> {
    try {
        const stored = await getPreference(PREFERENCE_KEY);
        return stored !== CURRENT_VERSION;
    } catch {
        // If the preference read fails, err on the side of running the migration
        return true;
    }
}

/**
 * Attempt to regenerate a thumbnail by locating the source video.
 * Returns the new relative thumbnail path, or null if regeneration is impossible.
 */
async function regenerateThumbnail(video: {
    id: string;
    assetId: string;
    filename: string;
}): Promise<string | null> {
    try {
        if (isSyntheticAssetId(video.assetId)) {
            // Managed video file — resolve path against current container
            const managedUri = await resolveManagedVideoFileUri(
                video.id,
                video.filename
            );
            if (!managedUri) return null;
            return await generateAndSaveThumbnail(managedUri, video.id);
        }
        // MediaLibrary-backed asset — do not force iCloud download during startup
        const info = await getAssetInfo(video.assetId, {
            shouldDownloadFromNetwork: false,
        });
        const sourceUri = info?.localUri ?? info?.uri;
        if (!sourceUri) return null;
        return await generateAndSaveThumbnail(sourceUri, video.id);
    } catch {
        return null;
    }
}

/**
 * Run the migration over all videos, reporting progress.
 *
 * @param onProgress Called after each video is processed. Safe to update React state.
 */
export async function runThumbnailMigration(
    onProgress?: (progress: MigrationProgress) => void
): Promise<void> {
    const videos = await getAllVideos();
    const total = videos.length;
    onProgress?.({ processed: 0, total });

    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        try {
            // Step 1: normalise path format
            const relative = toRelativeThumbnailPath(video.thumbnailUri);
            if (relative && relative !== video.thumbnailUri) {
                await updateVideoThumbnailUri(video.id, relative);
            }
            const normalised = relative ?? video.thumbnailUri;

            // Skip rows already marked as permanently missing — nothing to recover
            if (normalised === THUMBNAIL_MISSING_SENTINEL) continue;

            // Step 2: verify the file is present
            const exists = await thumbnailFileExists(normalised);
            if (exists) continue;

            // Step 3: regenerate from the source video when possible
            const regenerated = await regenerateThumbnail({
                id: video.id,
                assetId: video.assetId,
                filename: video.filename,
            });

            if (regenerated) {
                await updateVideoThumbnailUri(video.id, regenerated);
            } else {
                // Step 4: mark as permanently missing so the UI can show a placeholder
                await updateVideoThumbnailUri(
                    video.id,
                    THUMBNAIL_MISSING_SENTINEL
                );
            }
        } catch {
            // Never abort the whole migration for a single bad row
        }
        onProgress?.({ processed: i + 1, total });
    }

    await setPreference(PREFERENCE_KEY, CURRENT_VERSION);
}
