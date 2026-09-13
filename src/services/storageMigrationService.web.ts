/**
 * Web では保存方式の移行は行われない。
 *
 * Web のモックリポジトリは常に reference の行しか返さず、managed ファイルという
 * 概念が無い。ネイティブ側と同じ形を返して、起動シーケンスの分岐を増やさない。
 */
export const VIDEO_STORAGE_MIGRATION_KEY = "video_storage_migration_version";

export const VIDEO_STORAGE_MIGRATION_VERSION = "1";

export async function isVideoStorageMigrationNeeded(): Promise<boolean> {
    return false;
}

export async function migrateVideoStorage(): Promise<{
    updated: number;
    conflictCount: number;
    unsafeCount: number;
}> {
    return { updated: 0, conflictCount: 0, unsafeCount: 0 };
}
