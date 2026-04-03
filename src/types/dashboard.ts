/**
 * ダッシュボード機能で使用する型定義
 */
import type { VideoWithTags } from "./index";

/** シーズン定義（11月〜翌年5月） */
export interface Season {
    label: string; // "2025-26"
    startYear: number; // 2025
    endYear: number; // 2026
    dateFrom: number; // Nov 1 00:00 Unix sec
    dateTo: number; // May 31 23:59 Unix sec
}

/** サマリー統計 */
export interface DashboardSummary {
    totalSkiDays: number;
    totalVideoCount: number;
    totalDurationSeconds: number;
    uniqueResortCount: number;
    favoriteCount: number;
}

/** スキー場ランキング行 */
export interface ResortRanking {
    skiResortName: string;
    visitDays: number;
    videoCount: number;
    lastVisitTimestamp: number;
}

/** テクニック分布行 */
export interface TechniqueDistribution {
    name: string;
    count: number;
}

/** 月別トレンド行 */
export interface MonthlyTrend {
    yearMonth: string; // "2026-01"
    label: string; // "1月"
    videoCount: number;
    skiDays: number;
}

/** ヒートマップ用日付データ */
export interface HeatmapDay {
    dateKey: string; // "2026-01-15"
    count: number;
}

/** ダッシュボード全統計 */
export interface DashboardStats {
    summary: DashboardSummary;
    resortRanking: ResortRanking[];
    techniqueDistribution: TechniqueDistribution[];
    monthlyTrend: MonthlyTrend[];
    heatmapDays: HeatmapDay[];
    recentVideos: VideoWithTags[];
}
