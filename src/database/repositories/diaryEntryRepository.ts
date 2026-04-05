import { and, eq, gte, lte } from "drizzle-orm";

import { db, diaryEntries } from "../index";
import type { DiaryEntryInsert, DiaryEntrySelect } from "../schema";

/**
 * 日記エントリーに関するDB操作
 */

/** 全日記エントリーを取得する */
export async function getAllDiaryEntries(): Promise<DiaryEntrySelect[]> {
    return db.select().from(diaryEntries);
}

/** 指定日の日記エントリーを取得する */
export async function getDiaryEntryByDateKey(
    dateKey: string
): Promise<DiaryEntrySelect | null> {
    const rows = await db
        .select()
        .from(diaryEntries)
        .where(eq(diaryEntries.dateKey, dateKey))
        .limit(1);
    return rows[0] ?? null;
}

/** 日付範囲内の日記エントリーを取得する */
export async function getDiaryEntriesInRange(
    fromDateKey: string,
    toDateKey: string
): Promise<DiaryEntrySelect[]> {
    return db
        .select()
        .from(diaryEntries)
        .where(
            and(
                gte(diaryEntries.dateKey, fromDateKey),
                lte(diaryEntries.dateKey, toDateKey)
            )
        );
}

/** 日付範囲内で日記が存在する dateKey 一覧を取得する（カレンダー表示用） */
export async function getDiaryDateKeysInRange(
    fromDateKey: string,
    toDateKey: string
): Promise<string[]> {
    const rows = await db
        .select({ dateKey: diaryEntries.dateKey })
        .from(diaryEntries)
        .where(
            and(
                gte(diaryEntries.dateKey, fromDateKey),
                lte(diaryEntries.dateKey, toDateKey)
            )
        );
    return rows.map((r) => r.dateKey);
}

/** 日記エントリーを作成または更新する（dateKey で upsert） */
export async function upsertDiaryEntry(
    data: Omit<DiaryEntryInsert, "createdAt" | "updatedAt">
): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
        .insert(diaryEntries)
        .values({ ...data, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
            target: diaryEntries.dateKey,
            set: {
                skiResortName: data.skiResortName,
                weather: data.weather,
                snowCondition: data.snowCondition,
                impressions: data.impressions,
                temperature: data.temperature,
                companions: data.companions,
                fatigueLevel: data.fatigueLevel,
                expenses: data.expenses,
                numberOfRuns: data.numberOfRuns,
                updatedAt: now,
            },
        });
}

/** 日記エントリーを削除する */
export async function deleteDiaryEntry(dateKey: string): Promise<void> {
    await db
        .delete(diaryEntries)
        .where(eq(diaryEntries.dateKey, dateKey));
}
