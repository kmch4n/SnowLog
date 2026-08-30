import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

import { getTagsForVideos } from "../database/repositories/tagRepository";
import { getVideosByFilter } from "../database/repositories/videoRepository";
import { t } from "../i18n";
import type { FilterOptions, VideoWithTags } from "../types";
import { parseTechniques } from "../utils/parseTechniques";
import { areVideoListsEqual } from "../utils/videoListEquality";

interface FetchVideosOptions {
    showLoading?: boolean;
    /** Lets the focus effect discard a result whose filter is no longer current. */
    isCancelled?: () => boolean;
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
        // フィルターの変更は debounce されておらず、`useFocusEffect` はコールバックの
        // identity 変化で即座に再実行されるため取得が重なる。遅れて解決した古い
        // フィルターの結果を書き込まないようにする。
        const isCancelled = options.isCancelled ?? (() => false);
        if (showLoading) {
            setIsLoading(true);
        }
        setError(null);
        try {
            const rawVideos = await getVideosByFilter(stableFilter);

            // タグ情報を付加し、techniques を JSON 文字列からパース
            // タグは 1 クエリでまとめて引く（動画ごとに引くと件数に比例して往復が増える）
            const tagsByVideoId = await getTagsForVideos(rawVideos.map((v) => v.id));
            if (isCancelled()) return;
            const videosWithTags = rawVideos.map((video) => ({
                ...video,
                tags: tagsByVideoId.get(video.id) ?? [],
                techniques: parseTechniques(video.techniques as string | null),
            }));

            setVideos((current) =>
                areVideoListsEqual(current, videosWithTags) ? current : videosWithTags
            );
        } catch (e) {
            if (!isCancelled()) {
                setError(e instanceof Error ? e.message : t("errors.videoLoadFailed"));
            }
        } finally {
            // ここだけガードしない。取り消された取得がフラグを下ろしても
            // 「スピナーが一瞬早く消える」だけで次の描画が正す。
            setIsLoading(false);
        }
    }, [stableFilter]);

    // 画面にフォーカスが戻るたびにリロード（削除・編集の反映）
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            fetchVideos({ showLoading: false, isCancelled: () => cancelled });
            return () => {
                cancelled = true;
            };
        }, [fetchVideos])
    );

    const refresh = useCallback(async () => {
        await fetchVideos({ showLoading: true });
    }, [fetchVideos]);

    return { videos, isLoading, error, refresh };
}
