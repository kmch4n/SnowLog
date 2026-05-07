import * as FileSystem from "expo-file-system/legacy";

import { getAllVideos } from "@/database/repositories/videoRepository";

import {
    getManagedVideoDirectoryUri,
    getManagedVideoFileUri,
} from "./managedVideoFileService";
import { isSyntheticAssetId } from "./mediaService";
import {
    getThumbnailDirectoryUri,
    toRelativeThumbnailPath,
} from "./thumbnailService";

interface CleanupTarget {
    directoryUri: string;
    referencedFileNames: Set<string>;
    minimumAgeMs: number;
}

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

function thumbnailFileNameFromStoredUri(stored: string): string | null {
    const relative = toRelativeThumbnailPath(stored);
    if (!relative) return null;
    return fileNameFromUri(relative);
}

async function directoryExists(directoryUri: string): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(directoryUri);
    return info.exists && info.isDirectory;
}

function isRecentlyModified(modificationTimeSeconds: number, minimumAgeMs: number): boolean {
    if (minimumAgeMs <= 0) return false;
    const modifiedAtMs = modificationTimeSeconds * 1000;
    return Date.now() - modifiedAtMs < minimumAgeMs;
}

async function cleanupDirectory(target: CleanupTarget): Promise<{
    deletedFiles: number;
    deletedBytes: number;
}> {
    if (!(await directoryExists(target.directoryUri))) {
        return { deletedFiles: 0, deletedBytes: 0 };
    }

    const fileNames = await FileSystem.readDirectoryAsync(target.directoryUri);
    let deletedFiles = 0;
    let deletedBytes = 0;

    for (const fileName of fileNames) {
        if (target.referencedFileNames.has(fileName)) {
            continue;
        }

        const uri = `${target.directoryUri}${fileName}`;
        if (protectedFileUris.has(uri)) {
            continue;
        }

        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists || info.isDirectory) {
            continue;
        }

        if (isRecentlyModified(info.modificationTime, target.minimumAgeMs)) {
            continue;
        }

        deletedBytes += info.size;
        await FileSystem.deleteAsync(uri, { idempotent: true });
        deletedFiles += 1;
    }

    return { deletedFiles, deletedBytes };
}

export async function cleanupOrphanedFiles(
    options: OrphanedFileCleanupOptions = {}
): Promise<OrphanedFileCleanupResult> {
    const minimumAgeMs = options.minimumAgeMs ?? DEFAULT_MINIMUM_FILE_AGE_MS;
    const videos = await getAllVideos();
    const referencedThumbnails = new Set<string>();
    const referencedManagedVideos = new Set<string>();

    for (const video of videos) {
        const thumbnailFileName = thumbnailFileNameFromStoredUri(video.thumbnailUri);
        if (thumbnailFileName) {
            referencedThumbnails.add(thumbnailFileName);
        }

        if (isSyntheticAssetId(video.assetId)) {
            const managedUri = getManagedVideoFileUri(video.id, video.filename);
            const managedFileName = fileNameFromUri(managedUri);
            if (managedFileName) {
                referencedManagedVideos.add(managedFileName);
            }
        }
    }

    const thumbnailResult = await cleanupDirectory({
        directoryUri: getThumbnailDirectoryUri(),
        referencedFileNames: referencedThumbnails,
        minimumAgeMs,
    });
    const managedVideoResult = await cleanupDirectory({
        directoryUri: getManagedVideoDirectoryUri(),
        referencedFileNames: referencedManagedVideos,
        minimumAgeMs,
    });

    return {
        deletedFiles: thumbnailResult.deletedFiles + managedVideoResult.deletedFiles,
        deletedBytes: thumbnailResult.deletedBytes + managedVideoResult.deletedBytes,
        deletedThumbnails: thumbnailResult.deletedFiles,
        deletedManagedVideos: managedVideoResult.deletedFiles,
    };
}
