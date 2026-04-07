import { useRouter } from "expo-router";
import { useCallback } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
} from "react-native";

import { Colors } from "@/constants/colors";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { HorizontalBarChart } from "@/components/dashboard/HorizontalBarChart";
import { MonthlyBarChart } from "@/components/dashboard/MonthlyBarChart";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { VideoCardCompact } from "@/components/VideoCardCompact";
import { useDashboard } from "@/hooks/useDashboard";
import type { FilterOptions } from "@/types";
import type { Season } from "@/types/dashboard";
import { endOfMonth, startOfMonth } from "@/utils/dateUtils";
import { buildSearchHref } from "@/utils/searchRouteParams";

/**
 * ダッシュボード画面
 * シーズン単位の滑走統計をビジュアル表示する
 */
export default function DashboardScreen() {
    const router = useRouter();
    const { stats, isLoading, error, season, setSeason, availableSeasons } = useDashboard();

    const openSearch = useCallback(
        (filter: FilterOptions) => {
            router.push(buildSearchHref(filter));
        },
        [router]
    );

    const handleVideoPress = useCallback(
        (id: string) => {
            router.push(`/video/${id}`);
        },
        [router]
    );

    const handleResortPress = useCallback(
        (skiResortName: string) => {
            openSearch({
                skiResortName,
                dateFrom: season.dateFrom,
                dateTo: season.dateTo,
            });
        },
        [openSearch, season.dateFrom, season.dateTo]
    );

    const handleMonthPress = useCallback(
        (yearMonth: string) => {
            const [yearText, monthText] = yearMonth.split("-");
            const year = Number(yearText);
            const month = Number(monthText);
            if (!Number.isFinite(year) || !Number.isFinite(month)) {
                return;
            }

            openSearch({
                dateFrom: startOfMonth(year, month),
                dateTo: endOfMonth(year, month),
            });
        },
        [openSearch]
    );

    const handleDayPress = useCallback(
        (dateKey: string) => {
            const [yearText, monthText, dayText] = dateKey.split("-");
            const year = Number(yearText);
            const month = Number(monthText);
            const day = Number(dayText);
            if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
                return;
            }

            const dateFrom = Math.floor(new Date(year, month - 1, day, 0, 0, 0, 0).getTime() / 1000);
            const dateTo = Math.floor(new Date(year, month - 1, day, 23, 59, 59, 999).getTime() / 1000);

            openSearch({ dateFrom, dateTo });
        },
        [openSearch]
    );

    const isEmpty = !stats || stats.summary.totalVideoCount === 0;
    const showCentered = isLoading || !!error || isEmpty;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={showCentered ? styles.centeredContent : styles.content}
            showsVerticalScrollIndicator={false}
        >
            {isLoading ? (
                <ActivityIndicator size="large" color={Colors.alpineBlue} />
            ) : error ? (
                <>
                    <Text style={styles.emptyIcon}>⚠️</Text>
                    <Text style={styles.emptyTitle}>読み込みに失敗しました</Text>
                    <Text style={styles.emptyText}>{error}</Text>
                </>
            ) : isEmpty ? (
                <>
                    <Text style={styles.emptyIcon}>📊</Text>
                    <Text style={styles.emptyTitle}>データがありません</Text>
                    <Text style={styles.emptyText}>
                        {season.label} シーズンの動画をインポートすると{"\n"}
                        統計が表示されます
                    </Text>
                </>
            ) : (
                <>
                    {/* シーズン切替 */}
                    <SeasonSelector
                        seasons={availableSeasons}
                        selected={season}
                        onSelect={setSeason}
                    />

                    {/* サマリーカード */}
                    <SummaryCards summary={stats.summary} />

                    {/* スキー場ランキング */}
                    <DashboardSection title="スキー場ランキング">
                        <HorizontalBarChart
                            data={stats.resortRanking.map((r) => ({
                                label: r.skiResortName,
                                value: r.visitDays,
                                subLabel: `${r.videoCount}本`,
                            }))}
                            maxItems={5}
                            barColor={Colors.alpineBlue}
                            onItemPress={(item) => handleResortPress(item.label)}
                        />
                    </DashboardSection>

                    {/* テクニック分布 */}
                    <DashboardSection title="テクニック分布">
                        <HorizontalBarChart
                            data={stats.techniqueDistribution.map((t) => ({
                                label: t.name,
                                value: t.count,
                            }))}
                            maxItems={7}
                            barColor={Colors.morningGold}
                        />
                    </DashboardSection>

                    {/* 月別トレンド */}
                    <DashboardSection title="月別トレンド">
                        <MonthlyBarChart
                            data={stats.monthlyTrend}
                            onBarPress={(item) => handleMonthPress(item.yearMonth)}
                        />
                    </DashboardSection>

                    {/* アクティビティヒートマップ */}
                    <DashboardSection title="アクティビティ">
                        <ActivityHeatmap
                            days={stats.heatmapDays}
                            season={season}
                            onDayPress={(day) => handleDayPress(day.dateKey)}
                        />
                    </DashboardSection>

                    {/* 最近の動画 */}
                    {stats.recentVideos.length > 0 && (
                        <DashboardSection
                            title="最近の動画"
                            rightAction={{
                                label: "もっと見る →",
                                onPress: () => router.push("/(tabs)/search"),
                            }}
                        >
                            {stats.recentVideos.map((video) => (
                                <VideoCardCompact
                                    key={video.id}
                                    video={video}
                                    onPress={() => handleVideoPress(video.id)}
                                    showResort
                                />
                            ))}
                        </DashboardSection>
                    )}
                </>
            )}
        </ScrollView>
    );
}

// --- シーズンセレクター ---

interface SeasonSelectorProps {
    seasons: Season[];
    selected: Season;
    onSelect: (season: Season) => void;
}

function SeasonSelector({ seasons, selected, onSelect }: SeasonSelectorProps) {
    if (seasons.length <= 1) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seasonRow}
            style={styles.seasonScroll}
        >
            {seasons.map((s) => {
                const isActive = s.startYear === selected.startYear;
                return (
                    <TouchableOpacity
                        key={s.startYear}
                        style={[styles.seasonChip, isActive && styles.seasonChipActive]}
                        onPress={() => onSelect(s)}
                    >
                        <Text
                            style={[
                                styles.seasonText,
                                isActive && styles.seasonTextActive,
                            ]}
                        >
                            {s.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
    },
    content: {
        paddingTop: 12,
        paddingBottom: 32,
    },
    centeredContent: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: "center",
        lineHeight: 20,
    },
    seasonScroll: {
        marginBottom: 12,
    },
    seasonRow: {
        paddingHorizontal: 16,
        gap: 8,
    },
    seasonChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.frostGray,
    },
    seasonChipActive: {
        backgroundColor: Colors.alpineBlue,
    },
    seasonText: {
        fontSize: 14,
        fontWeight: "600",
        color: Colors.textSecondary,
    },
    seasonTextActive: {
        color: Colors.headerText,
    },
});
