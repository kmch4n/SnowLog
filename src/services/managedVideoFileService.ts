import * as FileSystem from "expo-file-system/legacy";

import { t } from "../i18n";
import {
    MANAGED_VIDEO_DIRECTORY,
    inferManagedExtension,
} from "../utils/managedVideoPath";

const MANAGED_VIDEO_DIR = `${FileSystem.documentDirectory}${MANAGED_VIDEO_DIRECTORY}`;

export function getManagedVideoDirectoryUri(): string {
    return MANAGED_VIDEO_DIR;
}

function isSupportedManagedVideoUri(sourceUri: string): boolean {
    return sourceUri.startsWith("file://") || sourceUri.startsWith("content://");
}

async function ensureManagedVideoDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(MANAGED_VIDEO_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(MANAGED_VIDEO_DIR, {
            intermediates: true,
        });
    }
}

export function getManagedVideoFileUri(
    videoId: string,
    filename?: string | null,
    sourceUri?: string | null
): string {
    const extension = inferManagedExtension(filename ?? sourceUri ?? null);
    return `${MANAGED_VIDEO_DIR}${videoId}.${extension}`;
}

export async function persistManagedVideoFile(
    sourceUri: string,
    videoId: string,
    filename?: string | null
): Promise<string> {
    if (!isSupportedManagedVideoUri(sourceUri)) {
        throw new Error(t("errors.unsupportedSource"));
    }

    await ensureManagedVideoDir();

    const destinationUri = getManagedVideoFileUri(videoId, filename, sourceUri);
    await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(
        () => {}
    );

    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });

    return destinationUri;
}

export async function managedVideoFileExists(
    videoId: string,
    filename?: string | null
): Promise<boolean> {
    const uri = getManagedVideoFileUri(videoId, filename);
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
}

export async function resolveManagedVideoFileUri(
    videoId: string,
    filename?: string | null
): Promise<string | null> {
    const uri = getManagedVideoFileUri(videoId, filename);
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? uri : null;
}

export async function deleteManagedVideoFile(
    videoId: string,
    filename?: string | null
): Promise<void> {
    const uri = getManagedVideoFileUri(videoId, filename);
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}
