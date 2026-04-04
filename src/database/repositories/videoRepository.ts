import { and, desc, eq, gte, inArray, like, lte, or } from "drizzle-orm";

import { db, videoTags, videos } from "../index";
import type { FilterOptions } from "../../types";
import type { VideoInsert } from "../schema";

/** Escape SQL LIKE special characters */
function escapeLike(text: string): string {
    return text.replace(/[%_]/g, "\\$&");
}

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
        const pattern = `%${escapeLike(options.searchText)}%`;
        conditions.push(
            or(
                like(videos.filename, pattern),
                like(videos.title, pattern),
                like(videos.memo, pattern),
            )!
        );
    }
    if (options.favoritesOnly) {
        conditions.push(eq(videos.isFavorite, 1));
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

/** メタデータ（メモ・スキー場名・タイトル・滑走種別）を更新する */
export async function updateVideoMeta(
    id: string,
    data: {
        memo?: string;
        skiResortName?: string | null;
        title?: string | null;
        techniques?: string | null; // JSON配列文字列をそのまま受け取る
    }
): Promise<void> {
    await db
        .update(videos)
        .set({ ...data, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(videos.id, id));
}

/** お気に入り状態をトグルする */
export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    await db
        .update(videos)
        .set({ isFavorite: isFavorite ? 1 : 0, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(videos.id, id));
}

/** 元ファイルの存在状態を更新する */
export async function updateFileAvailability(id: string, isAvailable: boolean): Promise<void> {
    await db
        .update(videos)
        .set({ isFileAvailable: isAvailable ? 1 : 0, updatedAt: Math.floor(Date.now() / 1000) })
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

/** capturedAt を更新する（NaN修復用） */
export async function updateVideoCapturedAt(id: string, capturedAt: number): Promise<void> {
    await db
        .update(videos)
        .set({ capturedAt, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(videos.id, id));
}

/** 複数動画のスキー場名を一括更新する（一括インポート用） */
export async function updateSkiResortForVideos(
    videoIds: string[],
    skiResortName: string
): Promise<void> {
    if (videoIds.length === 0) return;
    await db
        .update(videos)
        .set({ skiResortName, updatedAt: Math.floor(Date.now() / 1000) })
        .where(inArray(videos.id, videoIds));
}

/** 既にインポート済みの assetId を一括チェックする（重複検出用） */
export async function getExistingAssetIds(
    assetIds: string[]
): Promise<Set<string>> {
    if (assetIds.length === 0) return new Set();
    const rows = await db
        .select({ assetId: videos.assetId })
        .from(videos)
        .where(inArray(videos.assetId, assetIds));
    return new Set(rows.map((r) => r.assetId));
}
