import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";

import { getAllVideos } from "../database/repositories/videoRepository";
import {
    getAllTags,
    getTagsForVideo,
    getTagsForVideos,
} from "../database/repositories/tagRepository";
import { getAllTechniqueOptions } from "../database/repositories/techniqueOptionRepository";
import { getFavoriteResorts } from "../database/repositories/favoriteResortRepository";
import { getAllDiaryEntries } from "../database/repositories/diaryEntryRepository";
import { getAllPreferences } from "../database/repositories/appPreferenceRepository";
import { t } from "../i18n";
import type { Tag } from "../types";

import { ExportError, backupFileName, buildExportPayload } from "./exportPayload";

const BACKUP_FILE_PREFIX = "snowlog-backup-";

/**
 * Upper bound on how long we wait for the share sheet.
 *
 * `expo-sharing`'s iOS module leaves two of four completion cases unhandled —
 * notably "user picked an activity, that activity did not complete" — so the
 * promise can hang forever and latch the caller's in-progress flag. Nothing
 * runs after the sheet and the file is already written, so giving up waiting is
 * harmless. Long enough for a real share (composing a mail, picking a folder),
 * short enough that the settings row is not stuck until the app restarts.
 */
const SHARE_SHEET_TIMEOUT_MS = 60_000;

/**
 * Fallback for when the batched tag query fails: fetch one video at a time and
 * skip the ones that throw, so a single unreadable row costs its own tags only.
 */
async function collectTagsPerVideo(videoIds: string[]): Promise<Map<string, Tag[]>> {
    const map = new Map<string, Tag[]>();
    await Promise.all(
        videoIds.map(async (id) => {
            try {
                const videoTags = await getTagsForVideo(id);
                if (videoTags.length > 0) map.set(id, videoTags);
            } catch {
                // Tag lookup failure should not block the entire export
            }
        })
    );
    return map;
}

/**
 * Delete backups an earlier run left behind.
 *
 * The file is deliberately not deleted after a successful share: `shareAsync`
 * resolves when the sheet is dismissed, which can precede the receiving
 * extension finishing its read. Nothing needs the file afterwards, and
 * `cacheDirectory` is purgeable by iOS, so sweeping on the next run is enough
 * to bound disk use without racing anyone.
 */
async function sweepStaleBackups(directory: string): Promise<void> {
    try {
        const names = await FileSystem.readDirectoryAsync(directory);
        await Promise.all(
            names
                .filter(
                    (name) =>
                        name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith(".json")
                )
                .map((name) =>
                    FileSystem.deleteAsync(`${directory}${name}`, {
                        idempotent: true,
                    }).catch(() => {})
                )
        );
    } catch {
        // A failed sweep must not block the export itself
    }
}

/**
 * Export all user data as a full-backup JSON and open the system share sheet.
 *
 * Throws `ExportError` when the message is safe to show the user; anything
 * else that escapes is internal and the caller must not display it.
 */
export async function exportAllToJSON(): Promise<void> {
    const directory = FileSystem.cacheDirectory;
    if (!directory) {
        throw new ExportError(t("settings.export.sharingUnavailable"));
    }
    if (!(await Sharing.isAvailableAsync())) {
        throw new ExportError(t("settings.export.sharingUnavailable"));
    }

    await sweepStaleBackups(directory);

    const [videos, allTags, techniqueOptions, favoriteResorts, diaryEntries, preferences] =
        await Promise.all([
            getAllVideos(),
            getAllTags(),
            getAllTechniqueOptions(),
            getFavoriteResorts(),
            getAllDiaryEntries(),
            getAllPreferences(),
        ]);

    // One batched query covers the whole library; if it fails we drop back to
    // the per-video path, which tolerates a single bad row rather than
    // exporting every video with no tags at all.
    const videoIds = videos.map((video) => video.id);
    let tagsByVideoId: Map<string, Tag[]>;
    try {
        tagsByVideoId = await getTagsForVideos(videoIds);
    } catch {
        tagsByVideoId = await collectTagsPerVideo(videoIds);
    }

    const now = new Date();
    const payload = buildExportPayload({
        videos,
        tagsByVideoId,
        allTags,
        techniqueOptions,
        favoriteResorts,
        diaryEntries,
        preferences,
        appVersion: Constants.expoConfig?.version ?? "unknown",
        exportedAt: now.toISOString(),
    });

    const fileUri = `${directory}${backupFileName(now)}`;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 4), {
        encoding: FileSystem.EncodingType.UTF8,
    });

    // The timer is left dangling on the happy path; a single 60s timeout is not
    // worth the bookkeeping to cancel, and it holds no reference to the payload.
    await Promise.race([
        Sharing.shareAsync(fileUri, {
            mimeType: "application/json",
            dialogTitle: t("settings.export.shareDialogTitle"),
        }),
        new Promise<void>((resolve) => {
            setTimeout(resolve, SHARE_SHEET_TIMEOUT_MS);
        }),
    ]);
}
