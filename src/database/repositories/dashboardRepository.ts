/**
 * ダッシュボード用の集計リポジトリ
 * シーズン範囲内の動画を取得し、JS側で各種統計を算出する
 */
import { and, desc, gte, lte } from "drizzle-orm";

import { db, videos } from "../index";
import { toDateKey } from "../../utils/dateUtils";
import { parseTechniques } from "../../utils/parseTechniques";
import type {
    DashboardStats,
    DashboardSummary,
    HeatmapDay,
    MonthlyTrend,
    ResortRanking,
    Season,
    TechniqueDistribution,
} from "../../types/dashboard";

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

    // --- JS側で集計 ---

    // サマリー
    const dateKeys = new Set<string>();
    const resortNames = new Set<string>();
    let totalDuration = 0;
    let favoriteCount = 0;
    const techniqueCountMap = new Map<string, number>();

    for (const v of seasonVideos) {
        dateKeys.add(toDateKey(v.capturedAt));
        if (v.skiResortName) resortNames.add(v.skiResortName);
        totalDuration += v.duration;
        if (v.isFavorite === 1) favoriteCount++;
        const parsedTechniques = parseTechniques(v.techniques as string | null) ?? [];
        for (const name of parsedTechniques) {
            techniqueCountMap.set(name, (techniqueCountMap.get(name) ?? 0) + 1);
        }
    }

    const summary: DashboardSummary = {
        totalSkiDays: dateKeys.size,
        totalVideoCount: seasonVideos.length,
        totalDurationSeconds: totalDuration,
        uniqueResortCount: resortNames.size,
        favoriteCount,
    };

    // スキー場ランキング
    const resortMap = new Map<
        string,
        { dates: Set<string>; count: number; lastVisit: number }
    >();
    for (const v of seasonVideos) {
        if (!v.skiResortName) continue;
        const entry = resortMap.get(v.skiResortName) ?? {
            dates: new Set<string>(),
            count: 0,
            lastVisit: 0,
        };
        entry.dates.add(toDateKey(v.capturedAt));
        entry.count++;
        entry.lastVisit = Math.max(entry.lastVisit, v.capturedAt);
        resortMap.set(v.skiResortName, entry);
    }
    const resortRanking: ResortRanking[] = [...resortMap.entries()]
        .map(([name, data]) => ({
            skiResortName: name,
            visitDays: data.dates.size,
            videoCount: data.count,
            lastVisitTimestamp: data.lastVisit,
        }))
        .sort((a, b) => b.visitDays - a.visitDays || b.videoCount - a.videoCount);

    // テクニック分布
    const techniqueDistribution: TechniqueDistribution[] = [
        ...techniqueCountMap.entries(),
    ]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    // 月別トレンド（11月〜5月の7ヶ月分）
    const monthMap = new Map<string, { videoIds: Set<string>; dateKeys: Set<string> }>();
    // 空の月も含めて初期化
    const seasonMonths = [11, 12, 1, 2, 3, 4, 5];
    for (const mo of seasonMonths) {
        const yr = mo >= 11 ? season.startYear : season.endYear;
        const key = `${yr}-${String(mo).padStart(2, "0")}`;
        monthMap.set(key, { videoIds: new Set(), dateKeys: new Set() });
    }
    for (const v of seasonVideos) {
        const d = new Date(v.capturedAt * 1000);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const entry = monthMap.get(ym);
        if (entry) {
            entry.videoIds.add(v.id);
            entry.dateKeys.add(toDateKey(v.capturedAt));
        }
    }
    const monthlyTrend: MonthlyTrend[] = [...monthMap.entries()].map(
        ([ym, data]) => ({
            yearMonth: ym,
            label: `${parseInt(ym.split("-")[1])}月`,
            videoCount: data.videoIds.size,
            skiDays: data.dateKeys.size,
        })
    );

    // ヒートマップ
    const heatmapMap = new Map<string, number>();
    for (const v of seasonVideos) {
        const dk = toDateKey(v.capturedAt);
        heatmapMap.set(dk, (heatmapMap.get(dk) ?? 0) + 1);
    }
    const heatmapDays: HeatmapDay[] = [...heatmapMap.entries()]
        .map(([dateKey, count]) => ({ dateKey, count }))
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    // recentVideos は techniques のパースが必要（hook側でタグ付与）
    const recentVideos = recentRaw.map((v) => {
        const parsed = parseTechniques(v.techniques as string | null);
        return {
            ...v,
            techniques: parsed,
            tags: [], // hook側でタグを付与
        };
    });

    return {
        summary,
        resortRanking,
        techniqueDistribution,
        monthlyTrend,
        heatmapDays,
        recentVideos,
    };
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
