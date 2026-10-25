/**
 * Web用モックリポジトリ
 * expo-sqlite を使用せず、共有のインメモリストア（`@/mocks/webMockStore`）を読み書きする
 */
import { nextId, webMockStore } from "@/mocks/webMockStore";

import type { Tag, TagType } from "../../types";
import type { TagInsert, TagSelect } from "../schema";

function asTag(row: TagSelect): Tag {
    return { id: row.id, name: row.name, type: row.type as TagType };
}

/** ネイティブと同じ `tags.id` 昇順（`areVideoListsEqual` が位置で比較するため。Issue #59） */
function byId(a: Tag, b: Tag): number {
    return a.id - b.id;
}

function findTag(name: string, type: string): TagSelect | undefined {
    return webMockStore.tags.find((tag) => tag.name === name && tag.type === type);
}

export async function insertTag(data: TagInsert): Promise<void> {
    // tags(name, type) の一意制約に合わせ、重複は無視する
    if (findTag(data.name, data.type)) return;
    webMockStore.tags.push({ id: data.id ?? nextId("tags"), name: data.name, type: data.type });
}

export async function getOrCreateTag(name: string, type: TagType): Promise<Tag> {
    await insertTag({ name, type });
    return asTag(findTag(name, type)!);
}

export async function getTagsByType(type: TagType): Promise<Tag[]> {
    return webMockStore.tags.filter((tag) => tag.type === type).map(asTag);
}

export async function getAllTags(): Promise<Tag[]> {
    return webMockStore.tags.map(asTag);
}

export async function getTagsForVideo(videoId: string): Promise<Tag[]> {
    const tagIds = new Set(
        webMockStore.videoTags.filter((link) => link.videoId === videoId).map((link) => link.tagId)
    );
    return webMockStore.tags
        .filter((tag) => tagIds.has(tag.id))
        .map(asTag)
        .sort(byId);
}

/** ネイティブの一括取得に対応する。単件版と同じ結果を返すこと */
export async function getTagsForVideos(videoIds: string[]): Promise<Map<string, Tag[]>> {
    const map = new Map<string, Tag[]>();
    for (const videoId of videoIds) {
        const tags = await getTagsForVideo(videoId);
        if (tags.length > 0) map.set(videoId, tags);
    }
    return map;
}

export async function addTagToVideo(videoId: string, tagId: number): Promise<void> {
    const exists = webMockStore.videoTags.some(
        (link) => link.videoId === videoId && link.tagId === tagId
    );
    if (!exists) webMockStore.videoTags.push({ videoId, tagId });
}

export async function removeTagFromVideo(videoId: string, tagId: number): Promise<void> {
    webMockStore.videoTags = webMockStore.videoTags.filter(
        (link) => !(link.videoId === videoId && link.tagId === tagId)
    );
}

// ネイティブ側は Drizzle の同期トランザクションなので Promise を返さない。
export function setTagsForVideo(videoId: string, tagIds: number[]): void {
    webMockStore.videoTags = [
        ...webMockStore.videoTags.filter((link) => link.videoId !== videoId),
        ...[...new Set(tagIds)].map((tagId) => ({ videoId, tagId })),
    ];
}

export async function deleteCustomTag(tagId: number): Promise<void> {
    const tag = webMockStore.tags.find((row) => row.id === tagId);
    if (!tag || tag.type !== "custom") return;
    webMockStore.tags = webMockStore.tags.filter((row) => row.id !== tagId);
    webMockStore.videoTags = webMockStore.videoTags.filter((link) => link.tagId !== tagId);
}
