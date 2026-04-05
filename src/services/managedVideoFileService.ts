import * as FileSystem from "expo-file-system/legacy";

const MANAGED_VIDEO_DIR = `${FileSystem.documentDirectory}videos/`;

function inferExtension(filename?: string | null, uri?: string | null): string {
    const target = filename ?? uri ?? "";
    const match = target.match(/\.([a-zA-Z0-9]+)(?:$|\?)/);
    return match ? match[1].toLowerCase() : "mov";
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
    const extension = inferExtension(filename, sourceUri);
    return `${MANAGED_VIDEO_DIR}${videoId}.${extension}`;
}

export async function persistManagedVideoFile(
    sourceUri: string,
    videoId: string,
    filename?: string | null
): Promise<string> {
    if (!sourceUri.startsWith("file://")) {
        throw new Error("Could not access the imported video file.");
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
