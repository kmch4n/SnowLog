/**
 * Web用モックリポジトリ
 * expo-sqlite を使用せず、共有のインメモリストア（`@/mocks/webMockStore`）を読み書きする
 */
import { nextId, nowSeconds, webMockStore } from "@/mocks/webMockStore";

import type { DiaryEntryInsert, DiaryEntrySelect } from "../schema";

function inRange(entry: DiaryEntrySelect, fromDateKey: string, toDateKey: string): boolean {
    return entry.dateKey >= fromDateKey && entry.dateKey <= toDateKey;
}

export async function getAllDiaryEntries(): Promise<DiaryEntrySelect[]> {
    return [...webMockStore.diaryEntries];
}

export async function getDiaryEntryByDateKey(dateKey: string): Promise<DiaryEntrySelect | null> {
    return webMockStore.diaryEntries.find((entry) => entry.dateKey === dateKey) ?? null;
}

export async function getDiaryEntriesInRange(
    fromDateKey: string,
    toDateKey: string
): Promise<DiaryEntrySelect[]> {
    return webMockStore.diaryEntries.filter((entry) => inRange(entry, fromDateKey, toDateKey));
}

export async function getDiaryDateKeysInRange(
    fromDateKey: string,
    toDateKey: string
): Promise<string[]> {
    return (await getDiaryEntriesInRange(fromDateKey, toDateKey)).map((entry) => entry.dateKey);
}

/** dateKey で upsert する。createdAt は初回のまま残し、updatedAt だけ進める */
export async function upsertDiaryEntry(
    data: Omit<DiaryEntryInsert, "createdAt" | "updatedAt">
): Promise<void> {
    const now = nowSeconds();
    const fields = {
        skiResortName: data.skiResortName ?? null,
        weather: data.weather ?? null,
        snowCondition: data.snowCondition ?? null,
        impressions: data.impressions ?? "",
        temperature: data.temperature ?? null,
        companions: data.companions ?? null,
        fatigueLevel: data.fatigueLevel ?? null,
        expenses: data.expenses ?? null,
        numberOfRuns: data.numberOfRuns ?? null,
    };
    const existing = webMockStore.diaryEntries.find((entry) => entry.dateKey === data.dateKey);
    if (existing) {
        Object.assign(existing, fields, { updatedAt: now });
        return;
    }
    webMockStore.diaryEntries.push({
        id: nextId("diaryEntries"),
        dateKey: data.dateKey,
        ...fields,
        createdAt: now,
        updatedAt: now,
    });
}

export async function deleteDiaryEntry(dateKey: string): Promise<void> {
    webMockStore.diaryEntries = webMockStore.diaryEntries.filter(
        (entry) => entry.dateKey !== dateKey
    );
}

// Web ではバックアップ復元を提供しない（importJsonService.web.ts が先に断る）。
export async function insertDiaryEntriesForRestore(_rows: DiaryEntryInsert[]): Promise<number> {
    return 0;
}
