import { t } from "../i18n";

export function getManagedVideoFileUri(
    _videoId: string,
    _filename?: string | null,
    _sourceUri?: string | null
): string {
    return "";
}

export async function persistManagedVideoFile(
    _sourceUri: string,
    _videoId: string,
    _filename?: string | null
): Promise<string> {
    throw new Error(t("errors.managedFilesUnsupported"));
}

// Web に管理ディレクトリは存在しない。getManagedVideoFileUri と同じく空文字を返す。
export function getManagedVideoDirectoryUri(): string {
    return "";
}

export function managedPathToUri(_relativePath: string): string {
    return "";
}

export async function resolveManagedPath(
    _relativePath: string
): Promise<string | null> {
    return null;
}

export async function managedPathExists(
    _relativePath: string
): Promise<boolean> {
    return false;
}

export async function deleteManagedPath(_relativePath: string): Promise<void> {
    // no-op
}
