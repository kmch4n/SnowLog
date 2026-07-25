import { and, asc, eq, inArray } from "drizzle-orm";

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

/** 名前と種別でタグを取得する（存在しなければ作成して返す） */
export async function getOrCreateTag(name: string, type: TagType): Promise<Tag> {
    await db.insert(tags).values({ name, type }).onConflictDoNothing();
    const result = await db
        .select()
        .from(tags)
        .where(and(eq(tags.name, name), eq(tags.type, type)))
        .limit(1);
    if (!result[0]) {
        throw new Error(`Failed to upsert tag (name=${name}, type=${type})`);
    }
    return asTag(result[0]);
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
    const result = await db
        .select()
        .from(tags)
        .where(inArray(tags.id, tagIds))
        .orderBy(asc(tags.id));
    return result.map(asTag);
}

/**
 * 複数動画のタグを 1 クエリでまとめて取得する
 *
 * `getTagsForVideo` を動画ごとに呼ぶと 1 件あたり 2 往復になり、一覧の
 * フォーカス更新やエクスポートでクエリ数が動画数に比例して膨らむ。
 *
 * 並び順は `getTagsForVideo` と同じ `tags.id` 昇順にすること。
 * `areVideoListsEqual` がタグを位置で比較するため、順序が変わると
 * 一覧が毎回別物と判定されて再レンダーが多発する（Issue #59）。
 *
 * 返す `Tag` に join のキー（`videoId`）を混ぜないこと。単件版と構造が
 * 変わり、タグをそのまま展開・シリアライズする経路が増えたときに壊れる。
 */
export async function getTagsForVideos(videoIds: string[]): Promise<Map<string, Tag[]>> {
    const map = new Map<string, Tag[]>();
    if (videoIds.length === 0) return map;

    const rows = await db
        .select({
            videoId: videoTags.videoId,
            id: tags.id,
            name: tags.name,
            type: tags.type,
        })
        .from(videoTags)
        .innerJoin(tags, eq(videoTags.tagId, tags.id))
        .where(inArray(videoTags.videoId, videoIds))
        .orderBy(asc(tags.id));

    for (const row of rows) {
        const list = map.get(row.videoId);
        // videoId は取り出したうえで捨てる（row をそのまま渡すと Tag に紛れ込む）
        const tag = asTag({ id: row.id, name: row.name, type: row.type });
        if (list) {
            list.push(tag);
        } else {
            map.set(row.videoId, [tag]);
        }
    }
    return map;
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

/** 動画に紐付いているタグをすべて入れ替える（トランザクションで原子的に実行） */
export function setTagsForVideo(videoId: string, tagIds: number[]): void {
    db.transaction((tx) => {
        tx.delete(videoTags).where(eq(videoTags.videoId, videoId)).run();
        if (tagIds.length === 0) return;
        const rows: VideoTagInsert[] = tagIds.map((tagId) => ({ videoId, tagId }));
        tx.insert(videoTags).values(rows).run();
    });
}

/**
 * カスタムタグを削除する
 * SQLite の外部キー制約が既定で無効のため、video_tags を手動で削除してから tags を削除する
 */
export async function deleteCustomTag(tagId: number): Promise<void> {
    await db.delete(videoTags).where(eq(videoTags.tagId, tagId));
    await db.delete(tags).where(and(eq(tags.id, tagId), eq(tags.type, "custom")));
}
