/**
 * ダッシュボード用の集計リポジトリ
 * シーズン範囲内の動画を取得し、集計は `utils/dashboardStats.ts` に任せる
 */
import { and, desc, gte, lte } from "drizzle-orm";

import { db, videos } from "../index";
import { buildDashboardStats } from "../../utils/dashboardStats";
import type { DashboardStats, Season } from "../../types/dashboard";

/** シーズン内の動画データから全統計を算出する */
export async function getDashboardStats(season: Season): Promise<DashboardStats> {
    // 1. シーズン内の動画を軽量カラムのみで取得
    const seasonVideos = await db
        .select({
            id: videos.id,
            capturedAt: videos.capturedAt,
            duration: videos.duration,
            skiResortName: videos.skiResortName,
            isFavorite: videos.isFavorite,
            techniques: videos.techniques,
        })
        .from(videos)
        .where(
            and(
                gte(videos.capturedAt, season.dateFrom),
                lte(videos.capturedAt, season.dateTo)
            )
        );

    // 2. 最近の動画（フル行、最大5件）
    const recentRaw = await db
        .select()
        .from(videos)
        .where(
            and(
                gte(videos.capturedAt, season.dateFrom),
                lte(videos.capturedAt, season.dateTo)
            )
        )
        .orderBy(desc(videos.capturedAt))
        .limit(5);

    // 集計は Web のモックと共有する純粋関数で行う
    return buildDashboardStats(season, seasonVideos, recentRaw);
}

/** 最も古い動画の capturedAt を返す（シーズン一覧構築用） */
export async function getOldestCapturedAt(): Promise<number | null> {
    const result = await db
        .select({ capturedAt: videos.capturedAt })
        .from(videos)
        .orderBy(videos.capturedAt)
        .limit(1);
    return result[0]?.capturedAt ?? null;
}
