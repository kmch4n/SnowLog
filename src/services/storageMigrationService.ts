/**
 * 保存方式のバックフィルを起動時に 1 度だけ走らせる
 *
 * スキーマのマイグレーションのあと、サムネイル修復・孤児ファイル掃除・撮影日修復・
 * エクスポート・インポート・再生・取り込みの**いずれよりも前**に完了していなければ
 * ならない（#86 §5）。掃除系は `storage_mode` を見て所有ファイルを判定するので、
 * バックフィル前に走ると managed ファイルを孤児と誤認して消しかねない。
 *
 * 失敗したら握り潰さずに投げる。呼び出し側は後続をブロックして再試行を促すこと。
 */
import { getPreference } from "../database/repositories/appPreferenceRepository";
import {
    applyStorageBackfill,
    readStorageBackfillRows,
} from "../database/repositories/videoStorageRepository";
import { planStorageBackfill } from "./videoStorageBackfill";

/** `app_preferences` のキー。`weekStartDay` だけが camelCase の歴史的例外 */
export const VIDEO_STORAGE_MIGRATION_KEY = "video_storage_migration_version";

/** 現在の移行バージョン。値が一致していれば何もしない */
export const VIDEO_STORAGE_MIGRATION_VERSION = "1";

/** 移行が必要か。副作用なし */
export async function isVideoStorageMigrationNeeded(): Promise<boolean> {
    const stored = await getPreference(VIDEO_STORAGE_MIGRATION_KEY);
    return stored !== VIDEO_STORAGE_MIGRATION_VERSION;
}

/**
 * 保存方式をバックフィルする。完了済みなら即座に返る。
 * @returns 適用した行数と、手動復旧が要る件数
 */
export async function migrateVideoStorage(): Promise<{
    updated: number;
    conflictCount: number;
    unsafeCount: number;
}> {
    if (!(await isVideoStorageMigrationNeeded())) {
        return { updated: 0, conflictCount: 0, unsafeCount: 0 };
    }

    const rows = await readStorageBackfillRows();
    const plan = planStorageBackfill(rows);

    await applyStorageBackfill(
        plan,
        VIDEO_STORAGE_MIGRATION_KEY,
        VIDEO_STORAGE_MIGRATION_VERSION
    );

    return {
        updated: plan.updates.length,
        conflictCount: plan.conflictCount,
        unsafeCount: plan.unsafeCount,
    };
}
