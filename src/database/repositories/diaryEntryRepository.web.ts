/**
 * Web用スタブ
 * expo-sqlite は Web で動作しないため空実装を返す
 */
import type { DiaryEntryInsert, DiaryEntrySelect } from "../schema";

export async function getAllDiaryEntries(): Promise<DiaryEntrySelect[]> {
    return [];
}

export async function getDiaryEntryByDateKey(
    _dateKey: string
): Promise<DiaryEntrySelect | null> {
    return null;
}

export async function getDiaryEntriesInRange(
    _fromDateKey: string,
    _toDateKey: string
): Promise<DiaryEntrySelect[]> {
    return [];
}

export async function getDiaryDateKeysInRange(
    _fromDateKey: string,
    _toDateKey: string
): Promise<string[]> {
    return [];
}

export async function upsertDiaryEntry(
    _data: Omit<DiaryEntryInsert, "createdAt" | "updatedAt">
): Promise<void> {
    // Web では保存しない
}

export async function deleteDiaryEntry(_dateKey: string): Promise<void> {
    // Web では保存しない
}
