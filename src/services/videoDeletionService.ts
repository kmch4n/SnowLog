import {
    deleteVideos,
    getVideoById,
} from "@/database/repositories/videoRepository";

import { deleteManagedVideoFile } from "./managedVideoFileService";
import { isSyntheticAssetId } from "./mediaService";
import { deleteThumbnail } from "./thumbnailService";

export async function deleteVideosWithCleanup(videoIds: string[]): Promise<void> {
    if (videoIds.length === 0) {
        return;
    }

    const targets = await Promise.all(videoIds.map((id) => getVideoById(id)));

    await Promise.allSettled(
        targets
            .filter((video): video is NonNullable<typeof video> => video !== null)
            .flatMap((video) => {
                const tasks: Promise<void>[] = [];

                if (video.thumbnailUri) {
                    tasks.push(deleteThumbnail(video.thumbnailUri));
                }

                if (isSyntheticAssetId(video.assetId)) {
                    tasks.push(deleteManagedVideoFile(video.id, video.filename));
                }

                return tasks;
            })
    );

    await deleteVideos(videoIds);
}
