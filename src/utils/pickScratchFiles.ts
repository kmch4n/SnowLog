/**
 * The temporary files that belong to the current single-video pick on the import
 * screen: the staged copy of the movie and the preview JPEG of its first frame.
 *
 * They are deleted together when the user picks another movie, after a successful
 * save, and when the screen closes. A file that arrives after its pick was replaced
 * is deleted at once instead of being kept.
 *
 * The preview used to be created and never deleted, so every pick left a JPEG in
 * the cache directory.
 */
export interface PickScratchFiles {
    /**
     * Keeps `uri` until the next `clear()` when its pick is still current;
     * otherwise deletes it. Returns whether the file was kept.
     */
    keep(uri: string, isCurrent: boolean): Promise<boolean>;
    /** Deletes every kept file. A failed delete is ignored. */
    clear(): Promise<void>;
}

export function createPickScratchFiles(
    deleteFile: (uri: string) => Promise<void>
): PickScratchFiles {
    let kept: string[] = [];

    const deleteQuietly = async (uri: string) => {
        try {
            await deleteFile(uri);
        } catch {
            // A leftover file in the cache directory is harmless; iOS can purge it.
        }
    };

    return {
        async keep(uri, isCurrent) {
            if (isCurrent) {
                kept.push(uri);
                return true;
            }
            await deleteQuietly(uri);
            return false;
        },
        async clear() {
            // Take the list first, so a file kept while the deletes run survives.
            const current = kept;
            kept = [];
            await Promise.all(current.map(deleteQuietly));
        },
    };
}
