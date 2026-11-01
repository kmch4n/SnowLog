import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

import { insertDiaryEntriesForRestore } from "../database/repositories/diaryEntryRepository";
import { addFavoriteResort } from "../database/repositories/favoriteResortRepository";
import { insertPreferenceIfAbsent } from "../database/repositories/appPreferenceRepository";
import { getOrCreateTag } from "../database/repositories/tagRepository";
import { insertTechniqueOptionsForRestore } from "../database/repositories/techniqueOptionRepository";
import {
    getAllVideos,
    insertVideoWithTagsForRestore,
} from "../database/repositories/videoRepository";
import type { DiaryEntryInsert, VideoInsert } from "../database/schema";

import { ImportError, parseExportPayload } from "./importPayload";
import type { ImportPlan, ImportableTag } from "./importPayload";
import { managedPathExists } from "./managedVideoFileService";
import { checkAssetExists } from "./mediaService";
import { THUMBNAIL_MISSING_SENTINEL, thumbnailFileExists } from "./thumbnailService";
import { thumbnailBelongsToAnotherVideo } from "../utils/thumbnailPath";

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
    //
    // A copy is checked against its own file and nothing else. Finding the
    // original still in Photos does not make it available: the bytes this row
    // points at are the app's copy, which this device may never have had.
    const available =
        video.storageMode === "copy"
            ? video.managedVideoPath != null &&
              (await managedPathExists(video.managedVideoPath))
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

    // Each video goes in together with its tag links, in one transaction (#88).
    // Writing all videos first and the links in a later loop left videos with
    // no tags if the restore stopped in between, and a re-run skips existing
    // videos, so those tags never came back.
    //
    // A video that already exists is skipped whole: its current tags are what
    // the user has now, and the backup must not replace them.
    let videosInserted = 0;
    let unavailableVideos = 0;
    let tagFailures = 0;
    const existingVideoIds = new Set((await getAllVideos()).map((existing) => existing.id));
    for (const video of plan.videos) {
        const deviceState = await resolveDeviceState(video);
        const { isFileAvailable } = deviceState;
        // On a case-insensitive filesystem, V1's thumbnail file is v1's (#88).
        const thumbnailUri = thumbnailBelongsToAnotherVideo(video.id, existingVideoIds)
            ? THUMBNAIL_MISSING_SENTINEL
            : deviceState.thumbnailUri;
        const row: VideoInsert = {
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
            storageMode: video.storageMode,
            managedVideoPath: video.managedVideoPath,
            createdAt: video.createdAt,
            updatedAt: video.updatedAt,
        };

        let inserted: boolean;
        try {
            inserted = insertVideoWithTagsForRestore(row, await restoreTagIds(video.tagRefs));
        } catch {
            // The tags could not be resolved or linked. One video's tags are not
            // worth losing the video, or the rest of the restore. A failure to
            // write the video itself throws again here and stops the restore, as
            // it always has: that is a storage problem, not a tag problem.
            inserted = insertVideoWithTagsForRestore(row, []);
            // tagFailures means "the video is in, its tags are not". A video that
            // already existed was skipped, so it is not a tag failure.
            if (inserted) tagFailures += 1;
        }
        if (!inserted) continue;
        videosInserted += 1;
        if (isFileAvailable === 0) unavailableVideos += 1;
    }

    const diaryEntries = await insertDiaryEntriesForRestore(
        plan.diaryEntries.map((entry): DiaryEntryInsert => ({ ...entry }))
    );

    // Like every other table, a restore never overwrites what is already here:
    // a setting changed after the backup was made stays as the user left it (#88).
    let preferences = 0;
    for (const preference of plan.preferences) {
        if (await insertPreferenceIfAbsent(preference.key, preference.value)) {
            preferences += 1;
        }
    }

    return {
        videos: videosInserted,
        videosSkipped: plan.videos.length - videosInserted,
        tags,
        diaryEntries,
        techniqueOptions,
        favoriteResorts,
        preferences,
        unavailableVideos,
        tagFailures,
    };
}
