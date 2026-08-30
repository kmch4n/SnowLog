import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

import { insertDiaryEntriesForRestore } from "../database/repositories/diaryEntryRepository";
import { addFavoriteResort } from "../database/repositories/favoriteResortRepository";
import { setPreference } from "../database/repositories/appPreferenceRepository";
import { getOrCreateTag, setTagsForVideo } from "../database/repositories/tagRepository";
import { insertTechniqueOptionsForRestore } from "../database/repositories/techniqueOptionRepository";
import { insertVideosForRestore } from "../database/repositories/videoRepository";
import type { DiaryEntryInsert, VideoInsert } from "../database/schema";

import { ImportError, parseExportPayload } from "./importPayload";
import type { ImportPlan, ImportableTag } from "./importPayload";
import { managedVideoFileExists } from "./managedVideoFileService";
import { checkAssetExists, isSyntheticAssetId } from "./mediaService";
import { THUMBNAIL_MISSING_SENTINEL, thumbnailFileExists } from "./thumbnailService";

/**
 * Restore a backup written by `exportAllToJSON`.
 *
 * Named `importJsonService` rather than `importService` because the latter
 * already exists and pulls videos in from the photo library — a confusion #72
 * calls out by name.
 *
 * The backup carries metadata only. Video files and thumbnail images are not
 * in it, and `assetId` is a Photos identifier that means nothing on another
 * device, so a restore onto a new phone returns the log with the videos marked
 * unplayable. On the same device the assets are still there and the restore is
 * complete. Nothing here should be described as a device migration.
 */

export interface ImportPreview {
    plan: ImportPlan;
    counts: {
        videos: number;
        tags: number;
        diaryEntries: number;
        techniqueOptions: number;
        favoriteResorts: number;
    };
}

export interface ImportSummary {
    videos: number;
    videosSkipped: number;
    tags: number;
    diaryEntries: number;
    techniqueOptions: number;
    favoriteResorts: number;
    preferences: number;
    /** Imported videos whose asset could not be found on this device. */
    unavailableVideos: number;
    /** Videos whose tag links could not be written; the video itself is in. */
    tagFailures: number;
}

/**
 * Pick a `.json` file and parse it.
 *
 * Returns `null` when the user cancels — cancellation is not a failure and
 * must not raise an alert. Throws `ImportError` when the file cannot be read
 * or is not a backup.
 */
export async function pickAndParseBackup(): Promise<ImportPreview | null> {
    const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
        multiple: false,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    if (asset == null) return null;

    let text: string;
    try {
        text = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.UTF8,
        });
    } catch {
        throw new ImportError("readFailed");
    }

    let decoded: unknown;
    try {
        decoded = JSON.parse(text);
    } catch {
        throw new ImportError("notBackup");
    }

    const plan = parseExportPayload(decoded);

    return {
        plan,
        counts: {
            videos: plan.videos.length,
            tags: plan.tags.length,
            diaryEntries: plan.diaryEntries.length,
            techniqueOptions: plan.techniqueOptions.length,
            favoriteResorts: plan.favoriteResorts.length,
        },
    };
}

/** Resolve the two fields whose truth depends on this device, not the backup. */
async function resolveDeviceState(
    video: ImportPlan["videos"][number]
): Promise<{ isFileAvailable: number; thumbnailUri: string }> {
    // Nothing in the app ever sets isFileAvailable back to 1 — video/[id].tsx
    // only ever clears it — so this cannot be deferred to a later repair pass,
    // and the backup's own value is wrong the moment the phone changes.
    const available = isSyntheticAssetId(video.assetId)
        ? await managedVideoFileExists(video.id, video.filename)
        : await checkAssetExists(video.assetId);

    const thumbnailUri = (await thumbnailFileExists(video.thumbnailUri))
        ? video.thumbnailUri
        : THUMBNAIL_MISSING_SENTINEL;

    return { isFileAvailable: available ? 1 : 0, thumbnailUri };
}

async function restoreTagIds(refs: ImportableTag[]): Promise<number[]> {
    const ids: number[] = [];
    for (const ref of refs) {
        const tag = await getOrCreateTag(ref.name, ref.type);
        ids.push(tag.id);
    }
    return ids;
}

/**
 * Write a parsed plan. Call only after the user has confirmed the preview.
 *
 * Not atomic: it writes across six tables through repository calls, so a
 * failure partway leaves some rows in place. Every write is insert-or-ignore,
 * which makes running it again safe — that is the mitigation.
 */
export async function applyImportPlan(plan: ImportPlan): Promise<ImportSummary> {
    // Independent of everything else, so they go first.
    const techniqueOptions = await insertTechniqueOptionsForRestore(plan.techniqueOptions);

    let favoriteResorts = 0;
    for (const name of plan.favoriteResorts) {
        await addFavoriteResort(name);
        favoriteResorts += 1;
    }

    // Before videos, so a tag survives even when no video referencing it does.
    // The tag-management screen can create tags attached to nothing; those are
    // only reachable through the backup's top-level list.
    let tags = 0;
    for (const tag of plan.tags) {
        await getOrCreateTag(tag.name, tag.type);
        tags += 1;
    }

    const rows: VideoInsert[] = [];
    let unavailableVideos = 0;
    for (const video of plan.videos) {
        const { isFileAvailable, thumbnailUri } = await resolveDeviceState(video);
        if (isFileAvailable === 0) unavailableVideos += 1;
        rows.push({
            id: video.id,
            assetId: video.assetId,
            filename: video.filename,
            thumbnailUri,
            duration: video.duration,
            capturedAt: video.capturedAt,
            skiResortName: video.skiResortName,
            memo: video.memo,
            title: video.title,
            // The column stores the JSON text; the plan holds it parsed.
            techniques: video.techniques != null ? JSON.stringify(video.techniques) : null,
            isFileAvailable,
            isFavorite: video.isFavorite,
            createdAt: video.createdAt,
            updatedAt: video.updatedAt,
        });
    }

    const insertedIds = new Set(await insertVideosForRestore(rows));

    // Tags are restored ONLY for videos this run actually wrote.
    //
    // setTagsForVideo deletes a video's existing links before inserting, so
    // touching a skipped video would replace the tags the user has now with
    // whatever the backup happened to hold. And a video skipped because its
    // assetId already exists under a different id is not in `videos` at all
    // under the backup's id, so writing video_tags for it violates the foreign
    // key and, since this function is not atomic, would abort the rest.
    let tagFailures = 0;
    for (const video of plan.videos) {
        if (!insertedIds.has(video.id)) continue;
        if (video.tagRefs.length === 0) continue;
        try {
            setTagsForVideo(video.id, await restoreTagIds(video.tagRefs));
        } catch {
            // One video's tags are not worth losing the rest of the restore.
            tagFailures += 1;
        }
    }

    const diaryEntries = await insertDiaryEntriesForRestore(
        plan.diaryEntries.map((entry): DiaryEntryInsert => ({ ...entry }))
    );

    let preferences = 0;
    for (const preference of plan.preferences) {
        await setPreference(preference.key, preference.value);
        preferences += 1;
    }

    return {
        videos: insertedIds.size,
        videosSkipped: plan.videos.length - insertedIds.size,
        tags,
        diaryEntries,
        techniqueOptions,
        favoriteResorts,
        preferences,
        unavailableVideos,
        tagFailures,
    };
}
