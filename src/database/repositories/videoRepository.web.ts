/**
 * Web mock repository used for UI previews when SQLite is unavailable.
 *
 * Reads and writes the shared in-memory store, and returns the same raw row
 * shape as the native repository (techniques as a JSON string, no tags).
 */
import { nowSeconds, webMockStore } from "@/mocks/webMockStore";

import type { FilterOptions } from "../../types";
import type { VideoInsert, VideoSelect } from "../schema";

function toRow(data: VideoInsert): VideoSelect {
    return {
        id: data.id,
        assetId: data.assetId,
        filename: data.filename,
        thumbnailUri: data.thumbnailUri,
        duration: data.duration ?? 0,
        capturedAt: data.capturedAt,
        skiResortName: data.skiResortName ?? null,
        memo: data.memo ?? "",
        title: data.title ?? null,
        techniques: data.techniques ?? null,
        isFileAvailable: data.isFileAvailable ?? 1,
        isFavorite: data.isFavorite ?? 0,
        storageMode: data.storageMode ?? "reference",
        managedVideoPath: data.managedVideoPath ?? null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
}

function byNewest(a: VideoSelect, b: VideoSelect): number {
    return b.capturedAt - a.capturedAt;
}

function update(ids: string[], patch: Partial<VideoSelect>): void {
    const updatedAt = nowSeconds();
    for (const row of webMockStore.videos) {
        if (ids.includes(row.id)) Object.assign(row, patch, { updatedAt });
    }
}

function isUnassigned(row: VideoSelect): boolean {
    return row.skiResortName === null || row.skiResortName === "";
}

function dayKey(capturedAt: number): string {
    const date = new Date(capturedAt * 1000);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export async function insertVideo(data: VideoInsert): Promise<void> {
    webMockStore.videos.push(toRow(data));
}

export async function getVideoById(id: string): Promise<VideoSelect | null> {
    return webMockStore.videos.find((video) => video.id === id) ?? null;
}

export async function getVideoByAssetId(assetId: string): Promise<VideoSelect | null> {
    return webMockStore.videos.find((video) => video.assetId === assetId) ?? null;
}

export async function getVideosByFilter(options: FilterOptions = {}): Promise<VideoSelect[]> {
    let result = [...webMockStore.videos];

    if (options.skiResortName) {
        result = result.filter((video) => video.skiResortName === options.skiResortName);
    }
    if (options.dateFrom) {
        result = result.filter((video) => video.capturedAt >= options.dateFrom!);
    }
    if (options.dateTo) {
        result = result.filter((video) => video.capturedAt <= options.dateTo!);
    }
    if (options.searchText) {
        const query = options.searchText.toLowerCase();
        result = result.filter(
            (video) =>
                video.filename.toLowerCase().includes(query) ||
                (video.title?.toLowerCase().includes(query) ?? false) ||
                video.memo.toLowerCase().includes(query)
        );
    }
    if (options.tagIds && options.tagIds.length > 0) {
        const tagged = new Set(
            webMockStore.videoTags
                .filter((link) => options.tagIds!.includes(link.tagId))
                .map((link) => link.videoId)
        );
        result = result.filter((video) => tagged.has(video.id));
    }
    if (options.favoritesOnly) {
        result = result.filter((video) => video.isFavorite === 1);
    }

    return result.sort(byNewest);
}

export async function updateVideoMeta(
    id: string,
    data: {
        memo?: string;
        skiResortName?: string | null;
        title?: string | null;
        techniques?: string | null;
    }
): Promise<void> {
    update([id], data);
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    update([id], { isFavorite: isFavorite ? 1 : 0 });
}

export async function updateFileAvailability(id: string, isAvailable: boolean): Promise<void> {
    update([id], { isFileAvailable: isAvailable ? 1 : 0 });
}

export async function deleteVideo(id: string): Promise<void> {
    await deleteVideos([id]);
}

export async function getAllVideos(): Promise<VideoSelect[]> {
    return [...webMockStore.videos].sort(byNewest);
}

export async function updateVideoCapturedAt(id: string, capturedAt: number): Promise<void> {
    update([id], { capturedAt });
}

export async function updateSkiResortForVideos(
    videoIds: string[],
    skiResortName: string
): Promise<void> {
    update(videoIds, { skiResortName });
}

export async function updateSkiResortForUnassignedVideos(
    videoIds: string[],
    skiResortName: string
): Promise<void> {
    const unassigned = webMockStore.videos
        .filter((video) => videoIds.includes(video.id) && isUnassigned(video))
        .map((video) => video.id);
    update(unassigned, { skiResortName });
}

export async function getUnassignedVideoIdsForCapturedDays(
    capturedAtValues: number[],
    excludeVideoIds: string[] = []
): Promise<string[]> {
    const days = new Set(capturedAtValues.map(dayKey));
    return webMockStore.videos
        .filter((video) => !excludeVideoIds.includes(video.id))
        .filter((video) => isUnassigned(video) && days.has(dayKey(video.capturedAt)))
        .map((video) => video.id);
}

export async function getSkiResortNamesForCapturedDay(
    capturedAt: number,
    excludeVideoId?: string
): Promise<string[]> {
    const target = dayKey(capturedAt);
    const names = webMockStore.videos
        .filter((video) => video.id !== excludeVideoId)
        .filter((video) => dayKey(video.capturedAt) === target)
        .map((video) => video.skiResortName)
        .filter((name): name is string => name != null && name.trim().length > 0);

    return [...new Set(names)];
}

export async function getExistingAssetIds(assetIds: string[]): Promise<Set<string>> {
    const known = new Set(webMockStore.videos.map((video) => video.assetId));
    return new Set(assetIds.filter((assetId) => known.has(assetId)));
}

// Web からは呼ばれない（撮影日修復は _layout.tsx にしかなく、Web は _layout.web.tsx を描画する）。
export async function getVideosWithSuspiciousCapturedAt(
    minValidTimestamp: number
): Promise<VideoSelect[]> {
    return webMockStore.videos.filter((video) => video.capturedAt <= minValidTimestamp);
}

export async function updateVideoThumbnailUri(id: string, thumbnailUri: string): Promise<void> {
    update([id], { thumbnailUri });
}

export async function bulkSetFavorite(videoIds: string[], isFavorite: boolean): Promise<void> {
    update(videoIds, { isFavorite: isFavorite ? 1 : 0 });
}

/** ネイティブと同じく、紐付くタグのリンクも一緒に消える（ON DELETE CASCADE 相当） */
export async function deleteVideos(videoIds: string[]): Promise<void> {
    webMockStore.videos = webMockStore.videos.filter((video) => !videoIds.includes(video.id));
    webMockStore.videoTags = webMockStore.videoTags.filter(
        (link) => !videoIds.includes(link.videoId)
    );
}

export async function getRecentSkiResortNames(limit = 3): Promise<string[]> {
    const names: string[] = [];
    for (const video of [...webMockStore.videos].sort(byNewest)) {
        const name = video.skiResortName?.trim();
        if (!name || names.includes(name)) continue;
        names.push(name);
        if (names.length >= limit) break;
    }
    return names;
}

// Web ではバックアップ復元を提供しない（importJsonService.web.ts が先に断る）。
export async function insertVideosForRestore(_rows: VideoInsert[]): Promise<string[]> {
    return [];
}
