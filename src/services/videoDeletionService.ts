import {
    deleteVideos,
    getVideoById,
} from "@/database/repositories/videoRepository";

import { deleteManagedPath } from "./managedVideoFileService";

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

                // パスが無い copy 行（移行時に ID が安全でなかったもの）は、
                // 消すべきファイルを特定できない。捏造したパスで消しに行くより
                // 孤児として残す方が安全。
                if (video.managedVideoPath) {
                    tasks.push(deleteManagedPath(video.managedVideoPath));
                }

                return tasks;
            })
    );

    await deleteVideos(videoIds);
}
