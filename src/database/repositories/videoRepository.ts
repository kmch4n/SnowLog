import { and, desc, eq, gte, inArray, like, lte } from "drizzle-orm";

import { db, videoTags, videos } from "../index";
import type { FilterOptions } from "../../types";
import type { VideoInsert } from "../schema";

/**
 * 動画に関するDB操作をまとめたリポジトリ
 */

/** 動画を1件挿入する */
export async function insertVideo(data: VideoInsert): Promise<void> {
    await db.insert(videos).values(data);
}

/** IDで動画を1件取得する */
export async function getVideoById(id: string) {
    const result = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
    return result[0] ?? null;
}

/** assetIdで動画を1件取得する（重複インポート防止に使用） */
export async function getVideoByAssetId(assetId: string) {
    const result = await db.select().from(videos).where(eq(videos.assetId, assetId)).limit(1);
    return result[0] ?? null;
}

/** フィルター条件を指定して動画一覧を取得する */
export async function getVideosByFilter(options: FilterOptions = {}) {
    const conditions = [];

    if (options.skiResortName) {
        conditions.push(eq(videos.skiResortName, options.skiResortName));
    }
    if (options.dateFrom) {
        conditions.push(gte(videos.capturedAt, options.dateFrom));
    }
    if (options.dateTo) {
        conditions.push(lte(videos.capturedAt, options.dateTo));
    }
    if (options.searchText) {
        conditions.push(like(videos.filename, `%${options.searchText}%`));
    }

    // タグフィルターがある場合は該当する動画IDを先に取得
    if (options.tagIds && options.tagIds.length > 0) {
        const taggedVideoIds = await db
            .select({ videoId: videoTags.videoId })
            .from(videoTags)
            .where(inArray(videoTags.tagId, options.tagIds));

        const ids = taggedVideoIds.map((r) => r.videoId);
        if (ids.length === 0) return [];
        conditions.push(inArray(videos.id, ids));
    }

    return db
        .select()
        .from(videos)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(videos.capturedAt));
}

/** メモとスキー場名を更新する */
export async function updateVideoMeta(
    id: string,
    data: { memo?: string; skiResortName?: string | null }
): Promise<void> {
    await db
        .update(videos)
        .set({ ...data, updatedAt: Date.now() })
        .where(eq(videos.id, id));
}

/** 元ファイルの存在状態を更新する */
export async function updateFileAvailability(id: string, isAvailable: boolean): Promise<void> {
    await db
        .update(videos)
        .set({ isFileAvailable: isAvailable ? 1 : 0, updatedAt: Date.now() })
        .where(eq(videos.id, id));
}

/** 動画を削除する（関連する video_tags も cascade で削除される） */
export async function deleteVideo(id: string): Promise<void> {
    await db.delete(videos).where(eq(videos.id, id));
}

/** 全動画を撮影日時の降順で取得する */
export async function getAllVideos() {
    return db.select().from(videos).orderBy(desc(videos.capturedAt));
}
