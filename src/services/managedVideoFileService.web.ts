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
    throw new Error("Managed local video files are not supported on Web.");
}

export async function managedVideoFileExists(
    _videoId: string,
    _filename?: string | null
): Promise<boolean> {
    return false;
}

export async function resolveManagedVideoFileUri(
    _videoId: string,
    _filename?: string | null
): Promise<string | null> {
    return null;
}

export async function deleteManagedVideoFile(
    _videoId: string,
    _filename?: string | null
): Promise<void> {
    // Web stub
}
