import { useCallback, useEffect, useState } from "react";

import { getTagsForVideo } from "../database/repositories/tagRepository";
import { getVideosByFilter } from "../database/repositories/videoRepository";
import type { FilterOptions, VideoWithTags } from "../types";

/**
 * 動画一覧を取得・管理するカスタムフック
 *
 * @param filter フィルター条件（省略時は全件取得）
 */
export function useVideos(filter?: FilterOptions) {
    const [videos, setVideos] = useState<VideoWithTags[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVideos = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const rawVideos = await getVideosByFilter(filter);

            // タグ情報を付加
            const videosWithTags = await Promise.all(
                rawVideos.map(async (video) => ({
                    ...video,
                    tags: await getTagsForVideo(video.id),
                }))
            );

            setVideos(videosWithTags);
        } catch (e) {
            setError(e instanceof Error ? e.message : "動画の取得に失敗しました。");
        } finally {
            setIsLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchVideos();
    }, [fetchVideos]);

    return { videos, isLoading, error, refresh: fetchVideos };
}
