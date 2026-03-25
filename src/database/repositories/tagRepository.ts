import { and, eq, inArray } from "drizzle-orm";

import { db, tags, videoTags } from "../index";
import type { Tag, TagType } from "../../types";
import type { TagInsert, VideoTagInsert } from "../schema";

/**
 * DrizzleのSQLite結果は type が string として返るため、TagType にキャストする
 * DB には 'technique' | 'skier' | 'custom' の値しか入らない前提
 */
function asTag(row: { id: number; name: string; type: string }): Tag {
    return { ...row, type: row.type as TagType };
}

/**
 * タグに関するDB操作をまとめたリポジトリ
 */

/** タグを1件挿入する（既に存在する場合は無視） */
export async function insertTag(data: TagInsert): Promise<void> {
    await db.insert(tags).values(data).onConflictDoNothing();
}

/** 名前でタグを取得する（存在しなければ作成して返す） */
export async function getOrCreateTag(name: string, type: TagType): Promise<Tag> {
    const existing = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
    if (existing[0]) return asTag(existing[0]);

    await db.insert(tags).values({ name, type });
    const created = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
    return asTag(created[0]!);
}

/** タグ種別でタグ一覧を取得する */
export async function getTagsByType(type: TagType): Promise<Tag[]> {
    const rows = await db.select().from(tags).where(eq(tags.type, type));
    return rows.map(asTag);
}

/** 全タグを取得する */
export async function getAllTags(): Promise<Tag[]> {
    const rows = await db.select().from(tags);
    return rows.map(asTag);
}

/** 動画に紐付いているタグ一覧を取得する */
export async function getTagsForVideo(videoId: string): Promise<Tag[]> {
    const rows = await db
        .select({ tagId: videoTags.tagId })
        .from(videoTags)
        .where(eq(videoTags.videoId, videoId));

    if (rows.length === 0) return [];
    const tagIds = rows.map((r) => r.tagId);
    const result = await db.select().from(tags).where(inArray(tags.id, tagIds));
    return result.map(asTag);
}

/** 動画にタグを追加する */
export async function addTagToVideo(videoId: string, tagId: number): Promise<void> {
    const data: VideoTagInsert = { videoId, tagId };
    await db.insert(videoTags).values(data).onConflictDoNothing();
}

/** 動画からタグを削除する */
export async function removeTagFromVideo(videoId: string, tagId: number): Promise<void> {
    await db
        .delete(videoTags)
        .where(and(eq(videoTags.videoId, videoId), eq(videoTags.tagId, tagId)));
}

/** 動画に紐付いているタグをすべて入れ替える */
export async function setTagsForVideo(videoId: string, tagIds: number[]): Promise<void> {
    // 既存のタグを全削除してから再設定
    await db.delete(videoTags).where(eq(videoTags.videoId, videoId));

    if (tagIds.length === 0) return;
    const rows: VideoTagInsert[] = tagIds.map((tagId) => ({ videoId, tagId }));
    await db.insert(videoTags).values(rows);
}
