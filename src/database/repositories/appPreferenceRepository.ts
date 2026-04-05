import { eq } from "drizzle-orm";

import { db, appPreferences } from "../index";
import type { AppPreferenceSelect } from "../schema";

/**
 * アプリ設定に関するDB操作をまとめたリポジトリ
 */

/** 全設定値を取得する */
export async function getAllPreferences(): Promise<AppPreferenceSelect[]> {
    return db.select().from(appPreferences);
}

/** 設定値を取得する（未設定の場合は null） */
export async function getPreference(key: string): Promise<string | null> {
    const result = await db
        .select()
        .from(appPreferences)
        .where(eq(appPreferences.key, key))
        .limit(1);
    return result[0]?.value ?? null;
}

/** 設定値を保存する（upsert） */
export async function setPreference(key: string, value: string): Promise<void> {
    await db
        .insert(appPreferences)
        .values({ key, value })
        .onConflictDoUpdate({
            target: appPreferences.key,
            set: { value },
        });
}
