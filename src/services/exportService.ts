import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { getAllVideos } from "../database/repositories/videoRepository";
import { getAllTags, getTagsForVideo } from "../database/repositories/tagRepository";
import { getAllTechniqueOptions } from "../database/repositories/techniqueOptionRepository";
import { getFavoriteResorts } from "../database/repositories/favoriteResortRepository";
import { getAllDiaryEntries } from "../database/repositories/diaryEntryRepository";
import { getAllPreferences } from "../database/repositories/appPreferenceRepository";
import type { Tag, VideoWithTags } from "../types";
import { parseTechniques } from "../utils/parseTechniques";

/** Bump when the export payload shape changes */
const SCHEMA_VERSION = 1;
const APP_VERSION = "1.0.0";

/**
 * Export all user data as a full-backup JSON and open the system share sheet.
 */
export async function exportAllToJSON(): Promise<void> {
    const [videos, allTags, techniqueOptions, favoriteResorts, diaryEntries, preferences] =
        await Promise.all([
            getAllVideos(),
            getAllTags(),
            getAllTechniqueOptions(),
            getFavoriteResorts(),
            getAllDiaryEntries(),
            getAllPreferences(),
        ]);

    // Attach per-video tags (individual failures fall back to empty array)
    const videosWithTags: VideoWithTags[] = await Promise.all(
        videos.map(async (video) => {
            let videoTags: Tag[] = [];
            try {
                videoTags = await getTagsForVideo(video.id);
            } catch {
                // Tag lookup failure should not block the entire export
            }
            return {
                ...video,
                techniques: parseTechniques(video.techniques),
                tags: videoTags,
            };
        })
    );

    const exportData = {
        schemaVersion: SCHEMA_VERSION,
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        videos: videosWithTags.map((v) => ({
            id: v.id,
            assetId: v.assetId,
            filename: v.filename,
            thumbnailUri: v.thumbnailUri,
            duration: v.duration,
            capturedAt: v.capturedAt,
            skiResortName: v.skiResortName,
            memo: v.memo,
            title: v.title,
            techniques: v.techniques,
            isFileAvailable: v.isFileAvailable === 1,
            isFavorite: v.isFavorite === 1,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
            tags: v.tags.map((t) => ({ id: t.id, name: t.name, type: t.type })),
        })),
        tags: allTags.map((t) => ({ id: t.id, name: t.name, type: t.type })),
        techniqueOptions: techniqueOptions.map((o) => ({
            name: o.name,
            sortOrder: o.sortOrder,
        })),
        favoriteResorts,
        diaryEntries: diaryEntries.map((d) => ({
            dateKey: d.dateKey,
            skiResortName: d.skiResortName,
            weather: d.weather,
            snowCondition: d.snowCondition,
            impressions: d.impressions,
            temperature: d.temperature,
            companions: d.companions,
            fatigueLevel: d.fatigueLevel,
            expenses: d.expenses,
            numberOfRuns: d.numberOfRuns,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        })),
        preferences: preferences.map((p) => ({ key: p.key, value: p.value })),
    };

    const json = JSON.stringify(exportData, null, 4);
    const fileUri = `${FileSystem.documentDirectory}snowlog_backup_${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
    });

    try {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (!isSharingAvailable) {
            throw new Error("この端末では共有機能が使用できません。");
        }

        await Sharing.shareAsync(fileUri, {
            mimeType: "application/json",
            dialogTitle: "SnowLogデータをエクスポート",
        });
    } finally {
        // Clean up temp file regardless of outcome
        await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
    }
}
