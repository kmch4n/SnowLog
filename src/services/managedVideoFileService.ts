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

/**
 * DB に入っている相対パスを、いまのコンテナ基準の絶対 URI へ解決する。
 *
 * iOS はアップデートや復元でアプリコンテナのパスを変えるため、絶対 URI を保存
 * してはならない。保存するのは `videos/<id>.<ext>` だけで、解決は毎回ここで行う。
 */
export function managedPathToUri(relativePath: string): string {
    return `${FileSystem.documentDirectory}${relativePath}`;
}

/** 相対パスのファイルが実在すれば絶対 URI、無ければ null */
export async function resolveManagedPath(
    relativePath: string
): Promise<string | null> {
    const uri = managedPathToUri(relativePath);
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? uri : null;
}

/** 相対パスのファイルが実在するか */
export async function managedPathExists(relativePath: string): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(managedPathToUri(relativePath));
    return info.exists;
}

/** 相対パスのファイルを削除する。存在しなくてもエラーにしない */
export async function deleteManagedPath(relativePath: string): Promise<void> {
    await FileSystem.deleteAsync(managedPathToUri(relativePath), {
        idempotent: true,
    }).catch(() => {});
}

export async function managedVideoFileExists(
    videoId: string,
    filename?: string | null
): Promise<boolean> {
    const uri = getManagedVideoFileUri(videoId, filename);
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
}

