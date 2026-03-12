/**
 * Web用モックリポジトリ
 * expo-sqlite を使用せず、ブラウザでのUIプレビュー用にモックデータを返す
 */
import type { Tag, TagType } from "../../types";
import type { TagInsert } from "../schema";

const MOCK_TAGS: Tag[] = [
    { id: 1, name: "大回り", type: "technique" },
    { id: 2, name: "小回り", type: "technique" },
    { id: 3, name: "カービング", type: "technique" },
    { id: 4, name: "コブ", type: "technique" },
    { id: 5, name: "パウダー", type: "technique" },
    { id: 6, name: "フリー", type: "technique" },
    { id: 7, name: "田中コーチ", type: "skier" },
    { id: 8, name: "山田さん", type: "skier" },
];

export async function insertTag(_data: TagInsert): Promise<void> {
    // Web では保存しない
}

export async function getOrCreateTag(name: string, type: TagType): Promise<Tag> {
    const existing = MOCK_TAGS.find((t) => t.name === name);
    if (existing) return existing;
    return { id: MOCK_TAGS.length + 1, name, type };
}

export async function getTagsByType(type: TagType): Promise<Tag[]> {
    return MOCK_TAGS.filter((t) => t.type === type);
}

export async function getAllTags(): Promise<Tag[]> {
    return [...MOCK_TAGS];
}

export async function getTagsForVideo(videoId: string): Promise<Tag[]> {
    // videoRepository.web.ts のモックデータに合わせたマッピング
    const tagMap: Record<string, number[]> = {
        "mock-1": [1, 3],
        "mock-2": [2, 4],
        "mock-3": [5],
    };
    const tagIds = tagMap[videoId] ?? [];
    return MOCK_TAGS.filter((t) => tagIds.includes(t.id));
}

export async function addTagToVideo(_videoId: string, _tagId: number): Promise<void> {
    // Web では保存しない
}

export async function removeTagFromVideo(_videoId: string, _tagId: number): Promise<void> {
    // Web では保存しない
}

export async function setTagsForVideo(_videoId: string, _tagIds: number[]): Promise<void> {
    // Web では保存しない
}
