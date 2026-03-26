import { useCallback, useEffect, useState } from "react";

import { getTagsForVideo } from "../database/repositories/tagRepository";
import {
    deleteVideo as deleteVideoFromDb,
    getVideoById,
    updateVideoMeta,
} from "../database/repositories/videoRepository";
import { setTagsForVideo } from "../database/repositories/tagRepository";
import { checkAssetExists } from "../services/mediaService";
import type { Tag, VideoWithTags } from "../types";

/**
 * 動画1件の詳細情報を取得・更新するカスタムフック
 */
export function useVideoDetail(videoId: string) {
    const [video, setVideo] = useState<VideoWithTags | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVideo = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const raw = await getVideoById(videoId);
            if (!raw) {
                setError("動画が見つかりません。");
                return;
            }
            const tags = await getTagsForVideo(videoId);
            setVideo({ ...raw, tags });
        } catch (e) {
            setError(e instanceof Error ? e.message : "動画の取得に失敗しました。");
        } finally {
            setIsLoading(false);
        }
    }, [videoId]);

    useEffect(() => {
        fetchVideo();
    }, [fetchVideo]);

    /** メモを更新する */
    const updateMemo = useCallback(
        async (memo: string) => {
            await updateVideoMeta(videoId, { memo });
            await fetchVideo();
        },
        [videoId, fetchVideo]
    );

    /** スキー場名を更新する */
    const updateSkiResort = useCallback(
        async (skiResortName: string | null) => {
            await updateVideoMeta(videoId, { skiResortName });
            await fetchVideo();
        },
        [videoId, fetchVideo]
    );

    /** タグを入れ替える */
    const updateTags = useCallback(
        async (tagIds: number[]) => {
            await setTagsForVideo(videoId, tagIds);
            await fetchVideo();
        },
        [videoId, fetchVideo]
    );

    /** 元ファイルの存在を確認する */
    const checkFileExists = useCallback(async (): Promise<boolean> => {
        if (!video) return false;
        return checkAssetExists(video.assetId);
    }, [video]);

    /** 動画レコードを削除する（動画ファイル自体は削除しない） */
    const removeVideo = useCallback(async () => {
        await deleteVideoFromDb(videoId);
    }, [videoId]);

    return {
        video,
        isLoading,
        error,
        refresh: fetchVideo,
        updateMemo,
        updateSkiResort,
        updateTags,
        checkFileExists,
        removeVideo,
    };
}
