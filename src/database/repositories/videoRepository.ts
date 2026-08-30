import { and, desc, eq, gte, inArray, isNotNull, isNull, like, lte, ne, notInArray, or } from "drizzle-orm";

import { db, videoTags, videos } from "../index";
import type { FilterOptions } from "../../types";
import type { VideoInsert } from "../schema";

/** Escape SQL LIKE special characters */
function escapeLike(text: string): string {
    return text.replace(/[%_]/g, "\\$&");
}

function getLocalDayBounds(unixTimestamp: number): { start: number; end: number } {
    const date = new Date(unixTimestamp * 1000);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    return {
        start: Math.floor(start.getTime() / 1000),
        end: Math.floor(end.getTime() / 1000),
    };
}

function getUniqueDayBounds(capturedAtValues: number[]): { start: number; end: number }[] {
    const map = new Map<string, { start: number; end: number }>();
    for (const capturedAt of capturedAtValues) {
        if (!Number.isFinite(capturedAt)) continue;
        const bounds = getLocalDayBounds(capturedAt);
        map.set(`${bounds.start}:${bounds.end}`, bounds);
    }
    return Array.from(map.values());
}

function buildUnassignedResortCondition() {
    return or(isNull(videos.skiResortName), eq(videos.skiResortName, ""))!;
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

/** capturedAt が明らかに不正な動画のみ取得する（高速修復パス用） */
export async function getVideosWithSuspiciousCapturedAt(minValidTimestamp: number) {
    return db
        .select()
        .from(videos)
        .where(lte(videos.capturedAt, minValidTimestamp));
}

/** capturedAt を更新する（NaN修復用） */
export async function updateVideoCapturedAt(id: string, capturedAt: number): Promise<void> {
    await db
        .update(videos)
        .set({ capturedAt, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(videos.id, id));
}

/** サムネイルURIを更新する（パス移行・再生成用） */
export async function updateVideoThumbnailUri(id: string, thumbnailUri: string): Promise<void> {
    await db
        .update(videos)
        .set({ thumbnailUri, updatedAt: Math.floor(Date.now() / 1000) })
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

/** 複数動画のうち、スキー場未設定の動画だけを一括更新する */
export async function updateSkiResortForUnassignedVideos(
    videoIds: string[],
    skiResortName: string
): Promise<void> {
    if (videoIds.length === 0) return;
    await db
        .update(videos)
        .set({ skiResortName, updatedAt: Math.floor(Date.now() / 1000) })
        .where(and(inArray(videos.id, videoIds), buildUnassignedResortCondition()));
}

/** 指定した撮影日と同じ日で、スキー場未設定の動画IDを取得する */
export async function getUnassignedVideoIdsForCapturedDays(
    capturedAtValues: number[],
    excludeVideoIds: string[] = []
): Promise<string[]> {
    const bounds = getUniqueDayBounds(capturedAtValues);
    if (bounds.length === 0) return [];

    const dayConditions = bounds.map((b) =>
        and(gte(videos.capturedAt, b.start), lte(videos.capturedAt, b.end))!
    );
    const conditions = [
        or(...dayConditions)!,
        buildUnassignedResortCondition(),
    ];
    if (excludeVideoIds.length > 0) {
        conditions.push(notInArray(videos.id, excludeVideoIds));
    }

    const rows = await db
        .select({ id: videos.id })
        .from(videos)
        .where(and(...conditions));

    return rows.map((row) => row.id);
}

/** 指定した撮影日と同じ日に登録済みのスキー場名を取得する */
export async function getSkiResortNamesForCapturedDay(
    capturedAt: number,
    excludeVideoId?: string
): Promise<string[]> {
    const bounds = getLocalDayBounds(capturedAt);
    const rows = await db
        .select({ skiResortName: videos.skiResortName, capturedAt: videos.capturedAt })
        .from(videos)
        .where(
            and(
                gte(videos.capturedAt, bounds.start),
                lte(videos.capturedAt, bounds.end),
                excludeVideoId ? notInArray(videos.id, [excludeVideoId]) : undefined
            )
        )
        .orderBy(desc(videos.capturedAt));

    return [...new Set(rows
        .map((row) => row.skiResortName)
        .filter((name): name is string => name != null && name.trim().length > 0))];
}

/** 最近使われたスキー場名を新しい順で取得する */
export async function getRecentSkiResortNames(limit = 3): Promise<string[]> {
    const rows = await db
        .select({ skiResortName: videos.skiResortName })
        .from(videos)
        .where(and(isNotNull(videos.skiResortName), ne(videos.skiResortName, "")))
        .orderBy(desc(videos.capturedAt))
        .limit(Math.max(limit * 5, limit));

    const names: string[] = [];
    for (const row of rows) {
        const name = row.skiResortName?.trim();
        if (!name || names.includes(name)) continue;
        names.push(name);
        if (names.length >= limit) break;
    }
    return names;
}

/** 複数動画のお気に入り状態を一括設定する */
export async function bulkSetFavorite(
    videoIds: string[],
    isFavorite: boolean
): Promise<void> {
    if (videoIds.length === 0) return;
    await db
        .update(videos)
        .set({ isFavorite: isFavorite ? 1 : 0, updatedAt: Math.floor(Date.now() / 1000) })
        .where(inArray(videos.id, videoIds));
}

/** 複数動画を一括削除する（関連する video_tags も cascade で削除される） */
export async function deleteVideos(videoIds: string[]): Promise<void> {
    if (videoIds.length === 0) return;
    await db.delete(videos).where(inArray(videos.id, videoIds));
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

/**
 * バックアップ復元用に動画を挿入し、**実際に書き込んだ id** を返す。
 *
 * 件数ではなく id を返すのが要点。`setTagsForVideo` は既存リンクを全削除して
 * から張り直すため、スキップした動画に対して呼ぶとユーザーがバックアップ後に
 * 付けたタグを消してしまう。さらに `assetId` は unique だが `id` とは独立で、
 * 同じ写真が別 UUID で既に入っている場合は挿入がスキップされるので、その id を
 * `video_tags` に挿すと外部キー違反で落ちる（`foreign_keys = ON`）。
 *
 * 1 行ずつ挿すのは `changes` で「入ったかどうか」を確実に取るため。
 * `ON CONFLICT DO NOTHING` でスキップされた行は `changes` に数えられない。
 */
export async function insertVideosForRestore(rows: VideoInsert[]): Promise<string[]> {
    const insertedIds: string[] = [];
    for (const row of rows) {
        const result = await db.insert(videos).values(row).onConflictDoNothing();
        if (result.changes === 1) insertedIds.push(row.id);
    }
    return insertedIds;
}
