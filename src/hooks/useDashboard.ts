import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { getTagsForVideos } from "../database/repositories/tagRepository";
import {
    getDashboardStats,
    getOldestCapturedAt,
} from "../database/repositories/dashboardRepository";
import { t } from "../i18n";
import { buildSeason, getCurrentSeason } from "../utils/dateUtils";
import type { DashboardStats, Season } from "../types/dashboard";

/**
 * ダッシュボードの統計データを管理するカスタムフック
 * シーズン切替・データ取得・タグ付与を行う
 */
export function useDashboard() {
    const [season, setSeason] = useState<Season>(getCurrentSeason());
    const [availableSeasons, setAvailableSeasons] = useState<Season[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 利用可能シーズン一覧の構築
    useFocusEffect(
        useCallback(() => {
            (async () => {
                const oldest = await getOldestCapturedAt();
                if (oldest === null) {
                    setAvailableSeasons([getCurrentSeason()]);
                    return;
                }
                const oldDate = new Date(oldest * 1000);
                const oldMonth = oldDate.getMonth() + 1;
                const oldYear = oldDate.getFullYear();
                // 最も古い動画が属するシーズンの開始年
                const firstSeasonStart = oldMonth >= 11 ? oldYear : oldYear - 1;
                const current = getCurrentSeason();
                const seasons: Season[] = [];
                for (let y = current.startYear; y >= firstSeasonStart; y--) {
                    seasons.push(buildSeason(y));
                }
                setAvailableSeasons(seasons);
            })();
        }, [])
    );

    // データ取得
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;

            (async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const data = await getDashboardStats(season);

                    // recentVideos にタグを付与。1 クエリでまとめて引く（Issue #66 と同じ理由）
                    const tagsByVideoId = await getTagsForVideos(
                        data.recentVideos.map((video) => video.id)
                    );
                    const enrichedRecent = data.recentVideos.map((video) => ({
                        ...video,
                        tags: video.tags.length > 0
                            ? video.tags
                            : tagsByVideoId.get(video.id) ?? [],
                    }));

                    if (!cancelled) {
                        setStats({ ...data, recentVideos: enrichedRecent });
                    }
                } catch (e) {
                    if (!cancelled) {
                        setError(e instanceof Error ? e.message : t("dashboard.loadFailed"));
                    }
                } finally {
                    if (!cancelled) {
                        setIsLoading(false);
                    }
                }
            })();

            return () => {
                cancelled = true;
            };
        }, [season])
    );

    return { stats, isLoading, error, season, setSeason, availableSeasons };
}
