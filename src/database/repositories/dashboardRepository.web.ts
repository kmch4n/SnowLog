/**
 * ダッシュボード用 Web モックリポジトリ
 * ブラウザでの UI プレビュー用にモックデータを返す
 */
import type {
    DashboardStats,
    Season,
} from "../../types/dashboard";

/** モック統計データを返す */
export async function getDashboardStats(_season: Season): Promise<DashboardStats> {
    return {
        summary: {
            totalSkiDays: 12,
            totalVideoCount: 47,
            totalDurationSeconds: 12240,
            uniqueResortCount: 8,
            favoriteCount: 5,
        },
        resortRanking: [
            { skiResortName: "白馬八方尾根スキー場", visitDays: 6, videoCount: 18, lastVisitTimestamp: 1708848000 },
            { skiResortName: "蔵王温泉スキー場", visitDays: 4, videoCount: 12, lastVisitTimestamp: 1707638400 },
            { skiResortName: "ニセコグランヒラフ", visitDays: 3, videoCount: 9, lastVisitTimestamp: 1706774400 },
            { skiResortName: "志賀高原スキー場", visitDays: 2, videoCount: 5, lastVisitTimestamp: 1705564800 },
            { skiResortName: "野沢温泉スキー場", visitDays: 1, videoCount: 3, lastVisitTimestamp: 1704355200 },
        ],
        techniqueDistribution: [
            { name: "大回り", count: 18 },
            { name: "小回り", count: 12 },
            { name: "コブ", count: 8 },
            { name: "カービング", count: 6 },
            { name: "パウダー", count: 3 },
        ],
        monthlyTrend: [
            { yearMonth: "2025-11", label: "11月", videoCount: 3, skiDays: 1 },
            { yearMonth: "2025-12", label: "12月", videoCount: 8, skiDays: 3 },
            { yearMonth: "2026-01", label: "1月", videoCount: 14, skiDays: 4 },
            { yearMonth: "2026-02", label: "2月", videoCount: 12, skiDays: 3 },
            { yearMonth: "2026-03", label: "3月", videoCount: 7, skiDays: 2 },
            { yearMonth: "2026-04", label: "4月", videoCount: 3, skiDays: 1 },
            { yearMonth: "2026-05", label: "5月", videoCount: 0, skiDays: 0 },
        ],
        heatmapDays: [
            { dateKey: "2025-12-14", count: 3 },
            { dateKey: "2025-12-15", count: 2 },
            { dateKey: "2025-12-28", count: 4 },
            { dateKey: "2025-12-29", count: 3 },
            { dateKey: "2026-01-04", count: 2 },
            { dateKey: "2026-01-05", count: 1 },
            { dateKey: "2026-01-11", count: 5 },
            { dateKey: "2026-01-12", count: 3 },
            { dateKey: "2026-01-18", count: 2 },
            { dateKey: "2026-02-01", count: 4 },
            { dateKey: "2026-02-02", count: 2 },
            { dateKey: "2026-02-15", count: 3 },
            { dateKey: "2026-02-16", count: 1 },
            { dateKey: "2026-03-07", count: 2 },
            { dateKey: "2026-03-08", count: 3 },
            { dateKey: "2026-04-04", count: 1 },
        ],
        recentVideos: [
            {
                id: "mock-1",
                assetId: "asset-1",
                filename: "hakuba_carving_run.mov",
                thumbnailUri: "",
                duration: 45,
                capturedAt: 1706774400,
                skiResortName: "白馬八方尾根スキー場",
                memo: "カービングの練習",
                title: null,
                techniques: ["大回り", "カービング"],
                isFileAvailable: 1,
                isFavorite: 1,
                createdAt: 1706800000,
                updatedAt: 1706800000,
                tags: [
                    { id: 1, name: "大回り", type: "technique" },
                    { id: 3, name: "カービング", type: "technique" },
                ],
            },
            {
                id: "mock-2",
                assetId: "asset-2",
                filename: "zao_mogul_practice.mp4",
                thumbnailUri: "",
                duration: 28,
                capturedAt: 1707638400,
                skiResortName: "蔵王温泉スキー場",
                memo: "コブに入った",
                title: null,
                techniques: ["小回り", "コブ"],
                isFileAvailable: 1,
                isFavorite: 0,
                createdAt: 1707660000,
                updatedAt: 1707660000,
                tags: [
                    { id: 2, name: "小回り", type: "technique" },
                    { id: 4, name: "コブ", type: "technique" },
                ],
            },
            {
                id: "mock-3",
                assetId: "asset-3",
                filename: "niseko_powder_run.mov",
                thumbnailUri: "",
                duration: 62,
                capturedAt: 1708848000,
                skiResortName: "ニセコグランヒラフ",
                memo: "パウダー最高",
                title: null,
                techniques: ["パウダー"],
                isFileAvailable: 1,
                isFavorite: 0,
                createdAt: 1708870000,
                updatedAt: 1708870000,
                tags: [{ id: 5, name: "パウダー", type: "technique" }],
            },
        ],
    };
}

/** モック: 最も古い capturedAt を返す */
export async function getOldestCapturedAt(): Promise<number | null> {
    return 1704355200; // 2024-01-04
}
