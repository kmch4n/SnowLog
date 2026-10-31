/**
 * ダッシュボード統計の集計（純粋関数）
 *
 * 行の取得はリポジトリ（ネイティブは SQLite、Web はインメモリのモック）が行い、
 * 集計はここで行う。以前は `dashboardRepository.ts` の中にあり、Web 版は固定値の
 * モックを返していたため、Web のダッシュボードは一覧と食い違い、削除しても変わらなかった。
 *
 * import は相対のみ。`scripts/tests/` が素の `tsc` でコンパイルできるようにするため。
 */
import type {
    DashboardStats,
    DashboardSummary,
    HeatmapDay,
    MonthlyTrend,
    ResortRanking,
    Season,
    TechniqueDistribution,
} from "../types/dashboard";
import type { VideoWithTags } from "../types";
import { toDateKey } from "./dateUtils";
import { parseTechniques } from "./parseTechniques";
import { normalizeVideoStorageMode } from "./videoStorageMode";

/** 集計に使う列だけを持つ行 */
export interface DashboardVideoRow {
    id: string;
    capturedAt: number;
    duration: number;
    skiResortName: string | null;
    isFavorite: number;
    techniques: string | null;
}

/** 最近の動画として返すフル行（DB の行の形。`techniques` は JSON 文字列） */
export type DashboardRecentRow = Omit<VideoWithTags, "techniques" | "storageMode" | "tags"> & {
    techniques: string | null;
    storageMode: string;
};

/**
 * シーズン内の行から全統計を算出する
 * @param seasonVideos シーズン範囲内の動画（範囲の絞り込みは呼び出し側）
 * @param recentRaw 最近の動画（撮影日時の降順、最大 5 件。タグはフック側で付与する）
 */
export function buildDashboardStats(
    season: Season,
    seasonVideos: DashboardVideoRow[],
    recentRaw: DashboardRecentRow[]
): DashboardStats {
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
        const parsedTechniques = parseTechniques(v.techniques) ?? [];
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
    const recentVideos = recentRaw.map((v) => ({
        ...v,
        techniques: parseTechniques(v.techniques),
        storageMode: normalizeVideoStorageMode(v.storageMode),
        tags: [], // hook側でタグを付与
    }));

    return {
        summary,
        resortRanking,
        techniqueDistribution,
        monthlyTrend,
        heatmapDays,
        recentVideos,
    };
}
