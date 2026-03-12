import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { getAllVideos } from "../database/repositories/videoRepository";
import { getTagsForVideo } from "../database/repositories/tagRepository";
import type { VideoWithTags } from "../types";
import { formatDate } from "../utils/dateUtils";

/**
 * 全動画データをJSON形式でエクスポートし、システム共有UIを起動する
 */
export async function exportAllToJSON(): Promise<void> {
    const videos = await getAllVideos();

    // タグ情報を付加
    const videosWithTags: VideoWithTags[] = await Promise.all(
        videos.map(async (video) => ({
            ...video,
            tags: await getTagsForVideo(video.id),
        }))
    );

    const exportData = {
        exportedAt: new Date().toISOString(),
        totalCount: videosWithTags.length,
        videos: videosWithTags.map((v) => ({
            id: v.id,
            filename: v.filename,
            capturedAt: formatDate(v.capturedAt),
            duration: v.duration,
            skiResortName: v.skiResortName,
            memo: v.memo,
            tags: v.tags.map((t) => ({ name: t.name, type: t.type })),
            thumbnailUri: v.thumbnailUri,
            isFileAvailable: v.isFileAvailable === 1,
        })),
    };

    const json = JSON.stringify(exportData, null, 4);
    const fileUri = `${FileSystem.documentDirectory}snowlog_export_${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
    });

    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
        throw new Error("この端末では共有機能が使用できません。");
    }

    await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "SnowLogデータをエクスポート",
    });
}
