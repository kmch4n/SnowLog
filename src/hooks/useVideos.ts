import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

import { getTagsForVideo } from "../database/repositories/tagRepository";
import { getVideosByFilter } from "../database/repositories/videoRepository";
import { t } from "../i18n";
import type { FilterOptions, VideoWithTags } from "../types";
import { parseTechniques } from "../utils/parseTechniques";
import { areVideoListsEqual } from "../utils/videoListEquality";

interface FetchVideosOptions {
    showLoading?: boolean;
}

/**
 * 動画一覧を取得・管理するカスタムフック
 *
 * @param filter フィルター条件（省略時は全件取得）
 */
export function useVideos(filter?: FilterOptions) {
    const [videos, setVideos] = useState<VideoWithTags[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasFilter = filter != null;
    const skiResortName = filter?.skiResortName;
    const tagIds = filter?.tagIds;
    const dateFrom = filter?.dateFrom;
    const dateTo = filter?.dateTo;
    const searchText = filter?.searchText;
    const favoritesOnly = filter?.favoritesOnly;
    const tagIdsKey = JSON.stringify(tagIds ?? null);
    const stableTagIds = useMemo<number[] | undefined>(() => {
        const parsed = JSON.parse(tagIdsKey) as number[] | null;

        return parsed == null ? undefined : parsed;
    }, [tagIdsKey]);

    const stableFilter = useMemo<FilterOptions | undefined>(() => {
        if (!hasFilter) {
            return undefined;
        }

        return {
            skiResortName,
            tagIds: stableTagIds,
            dateFrom,
            dateTo,
            searchText,
            favoritesOnly,
        };
    }, [hasFilter, skiResortName, stableTagIds, dateFrom, dateTo, searchText, favoritesOnly]);

    const fetchVideos = useCallback(async (options: FetchVideosOptions = {}) => {
        const showLoading = options.showLoading ?? true;
        if (showLoading) {
            setIsLoading(true);
        }
        setError(null);
        try {
            const rawVideos = await getVideosByFilter(stableFilter);

            // タグ情報を付加し、techniques を JSON 文字列からパース
            const videosWithTags = await Promise.all(
                rawVideos.map(async (video) => {
                    return {
                        ...video,
                        tags: await getTagsForVideo(video.id),
                        techniques: parseTechniques(video.techniques as string | null),
                    };
                })
            );

            setVideos((current) =>
                areVideoListsEqual(current, videosWithTags) ? current : videosWithTags
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : t("errors.videoLoadFailed"));
        } finally {
            setIsLoading(false);
        }
    }, [stableFilter]);

    // 画面にフォーカスが戻るたびにリロード（削除・編集の反映）
    useFocusEffect(
        useCallback(() => {
            fetchVideos({ showLoading: false });
        }, [fetchVideos])
    );

    const refresh = useCallback(async () => {
        await fetchVideos({ showLoading: true });
    }, [fetchVideos]);

    return { videos, isLoading, error, refresh };
}
