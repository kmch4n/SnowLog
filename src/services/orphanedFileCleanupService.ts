import * as FileSystem from "expo-file-system/legacy";

import { getAllVideos } from "@/database/repositories/videoRepository";

import {
    getManagedVideoDirectoryUri,
    managedPathToUri,
} from "./managedVideoFileService";
import {
    type CleanupDirectory,
    type CleanupFileInfo,
    runOrphanCleanup,
} from "./orphanCleanupRun";
import {
    getThumbnailDirectoryUri,
    toRelativeThumbnailPath,
} from "./thumbnailService";

export interface OrphanedFileCleanupResult {
    deletedFiles: number;
    deletedBytes: number;
    deletedThumbnails: number;
    deletedManagedVideos: number;
}

export interface OrphanedFileCleanupOptions {
    minimumAgeMs?: number;
}

const DEFAULT_MINIMUM_FILE_AGE_MS = 5 * 60 * 1000;
const protectedFileUris = new Set<string>();

export function protectFilesFromOrphanedCleanup(fileUris: string[]): () => void {
    for (const uri of fileUris) {
        protectedFileUris.add(uri);
    }

    return () => {
        for (const uri of fileUris) {
            protectedFileUris.delete(uri);
        }
    };
}

function fileNameFromUri(uri: string): string | null {
    const trimmed = uri.replace(/\/+$/, "");
    const index = trimmed.lastIndexOf("/");
    if (index === -1) return null;
    return trimmed.slice(index + 1);
}

function directoryUri(directory: CleanupDirectory): string {
    return directory === "thumbnails" ? getThumbnailDirectoryUri() : getManagedVideoDirectoryUri();
}

async function listRegularFiles(directory: CleanupDirectory): Promise<CleanupFileInfo[]> {
    const dirUri = directoryUri(directory);
    const dirInfo = await FileSystem.getInfoAsync(dirUri);
    if (!dirInfo.exists || !dirInfo.isDirectory) return [];

    const files: CleanupFileInfo[] = [];
    for (const name of await FileSystem.readDirectoryAsync(dirUri)) {
        const info = await FileSystem.getInfoAsync(`${dirUri}${name}`);
        if (!info.exists || info.isDirectory) continue;
        files.push({ name, size: info.size, modifiedAtMs: info.modificationTime * 1000 });
    }
    return files;
}

/**
 * 行から参照されていないサムネイルとアプリ管理の動画ファイルを消す。
 * 手順と、取り込みと同時に走ったときの安全性は `orphanCleanupRun.ts` を参照。
 */
export async function cleanupOrphanedFiles(
    options: OrphanedFileCleanupOptions = {}
): Promise<OrphanedFileCleanupResult> {
    const minimumAgeMs = options.minimumAgeMs ?? DEFAULT_MINIMUM_FILE_AGE_MS;
    const counts = await runOrphanCleanup(
        {
            listVideos: getAllVideos,
            listFiles: listRegularFiles,
            isProtected: (directory, fileName) =>
                protectedFileUris.has(`${directoryUri(directory)}${fileName}`),
            deleteFile: (directory, fileName) =>
                FileSystem.deleteAsync(`${directoryUri(directory)}${fileName}`, { idempotent: true }),
            thumbnailFileName: (stored) => {
                const relative = toRelativeThumbnailPath(stored);
                return relative ? fileNameFromUri(relative) : null;
            },
            managedFileName: (relativePath) => fileNameFromUri(managedPathToUri(relativePath)),
            nowMs: () => Date.now(),
        },
        minimumAgeMs
    );

    return {
        deletedFiles: counts.deletedThumbnails + counts.deletedManagedVideos,
        deletedBytes: counts.deletedBytes,
        deletedThumbnails: counts.deletedThumbnails,
        deletedManagedVideos: counts.deletedManagedVideos,
    };
}
