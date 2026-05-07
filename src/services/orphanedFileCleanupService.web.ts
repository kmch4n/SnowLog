export interface OrphanedFileCleanupResult {
    deletedFiles: number;
    deletedBytes: number;
    deletedThumbnails: number;
    deletedManagedVideos: number;
}

export interface OrphanedFileCleanupOptions {
    minimumAgeMs?: number;
}

export function protectFilesFromOrphanedCleanup(): () => void {
    return () => {};
}

export async function cleanupOrphanedFiles(
    _options: OrphanedFileCleanupOptions = {}
): Promise<OrphanedFileCleanupResult> {
    return {
        deletedFiles: 0,
        deletedBytes: 0,
        deletedThumbnails: 0,
        deletedManagedVideos: 0,
    };
}
