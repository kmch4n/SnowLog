import { useCallback, useEffect, useState } from "react";

import { getTagsForVideo, setTagsForVideo } from "../database/repositories/tagRepository";
import {
    deleteVideo as deleteVideoFromDb,
    getVideoById,
    toggleFavorite as toggleFavoriteInDb,
    updateVideoMeta,
} from "../database/repositories/videoRepository";
import { hapticLight } from "../services/hapticsService";
import {
    deleteManagedVideoFile,
    managedVideoFileExists,
} from "../services/managedVideoFileService";
import { checkAssetExists, isSyntheticAssetId } from "../services/mediaService";
import { deleteThumbnail } from "../services/thumbnailService";
import { t } from "../i18n";
import type { VideoWithTags } from "../types";
import { parseTechniques } from "../utils/parseTechniques";

/**
 * 動画1件の詳細情報を取得・更新するカスタムフック
 */
export function useVideoDetail(videoId: string) {
    const [video, setVideo] = useState<VideoWithTags | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * `isCancelled` は他の 3 フックと形を揃えるための防御であって、現状の導線で
     * 発火する経路は無い。`/video/[id]` へは全て `router.push` / `replace` で入り、
     * 毎回新しい画面インスタンスが `videoId` を固定して載るため、マウント済みの
     * インスタンスで `videoId` が変わることがない（`_layout.tsx` に `getId` も無い）。
     * 動画間をスワイプで移動する UI を将来入れるとインスタンスが再利用されるので、
     * そのときに効く。
     */
    const fetchVideo = useCallback(
        async (isCancelled: () => boolean = () => false) => {
            setIsLoading(true);
            setError(null);
            try {
                const raw = await getVideoById(videoId);
                if (isCancelled()) return;
                if (!raw) {
                    setError(t("videoDetail.notFound"));
                    return;
                }
                const tags = await getTagsForVideo(videoId);
                if (isCancelled()) return;
                const techniques = parseTechniques(raw.techniques as string | null);
                setVideo({ ...raw, tags, techniques });
            } catch (e) {
                if (!isCancelled()) {
                    setError(e instanceof Error ? e.message : t("videoDetail.loadFailed"));
                }
            } finally {
                setIsLoading(false);
            }
        },
        [videoId]
    );

    useEffect(() => {
        let cancelled = false;
        fetchVideo(() => cancelled);
        return () => {
            cancelled = true;
        };
    }, [fetchVideo]);

    /** タイトルを更新する（debounceはUI側で実装） */
    const updateTitle = useCallback(
        async (title: string | null) => {
            await updateVideoMeta(videoId, { title });
            await fetchVideo();
        },
        [videoId, fetchVideo]
    );

    /** 滑走種別を更新する（即時保存） */
    const updateTechniques = useCallback(
        async (techniques: string[]) => {
            const json = techniques.length > 0 ? JSON.stringify(techniques) : null;
            await updateVideoMeta(videoId, { techniques: json });
            await fetchVideo();
        },
        [videoId, fetchVideo]
    );

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

    /** お気に入り状態をトグルする */
    const toggleFavorite = useCallback(async () => {
        if (!video) return;
        hapticLight();
        await toggleFavoriteInDb(videoId, video.isFavorite !== 1);
        await fetchVideo();
    }, [video, videoId, fetchVideo]);

    /** 元ファイルの存在を確認する */
    const checkFileExists = useCallback(async (): Promise<boolean> => {
        if (!video) return false;
        if (isSyntheticAssetId(video.assetId)) {
            return managedVideoFileExists(video.id, video.filename);
        }
        return checkAssetExists(video.assetId);
    }, [video]);

    /** 動画レコードを削除する（動画ファイル自体は削除しない） */
    const removeVideo = useCallback(async () => {
        if (video?.thumbnailUri) {
            await deleteThumbnail(video.thumbnailUri);
        }
        if (video && isSyntheticAssetId(video.assetId)) {
            await deleteManagedVideoFile(video.id, video.filename);
        }
        await deleteVideoFromDb(videoId);
    }, [videoId, video]);

    return {
        video,
        isLoading,
        error,
        refresh: fetchVideo,
        updateTitle,
        updateTechniques,
        updateMemo,
        updateSkiResort,
        updateTags,
        toggleFavorite,
        checkFileExists,
        removeVideo,
    };
}
