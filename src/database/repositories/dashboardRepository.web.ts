/**
 * ダッシュボード用 Web モックリポジトリ
 * 共有のインメモリストア（`@/mocks/webMockStore`）の動画から、ネイティブと同じ集計関数で算出する。
 * 以前は固定値を返していたため、一覧の件数とも削除操作とも連動しなかった。
 */
import { webMockStore } from "@/mocks/webMockStore";

import { buildDashboardStats } from "../../utils/dashboardStats";
import type { DashboardStats, Season } from "../../types/dashboard";

export async function getDashboardStats(season: Season): Promise<DashboardStats> {
    const seasonVideos = webMockStore.videos
        .filter((video) => video.capturedAt >= season.dateFrom && video.capturedAt <= season.dateTo)
        .sort((a, b) => b.capturedAt - a.capturedAt);
    return buildDashboardStats(season, seasonVideos, seasonVideos.slice(0, 5));
}

export async function getOldestCapturedAt(): Promise<number | null> {
    if (webMockStore.videos.length === 0) return null;
    return Math.min(...webMockStore.videos.map((video) => video.capturedAt));
}
