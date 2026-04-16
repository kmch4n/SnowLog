/**
 * Web用スタブ — native のファイルシステムが無いため常にマイグレーション不要
 */

export interface MigrationProgress {
    processed: number;
    total: number;
}

export async function isThumbnailMigrationNeeded(): Promise<boolean> {
    return false;
}

export async function runThumbnailMigration(
    _onProgress?: (progress: MigrationProgress) => void
): Promise<void> {
    // no-op
}
