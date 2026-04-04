import { useRouter } from "expo-router";
import { useCallback } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { HorizontalBarChart } from "@/components/dashboard/HorizontalBarChart";
import { MonthlyBarChart } from "@/components/dashboard/MonthlyBarChart";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { VideoCardCompact } from "@/components/VideoCardCompact";
import { useDashboard } from "@/hooks/useDashboard";
import type { Season } from "@/types/dashboard";

/**
 * ダッシュボード画面
 * シーズン単位の滑走統計をビジュアル表示する
 */
export default function DashboardScreen() {
    const router = useRouter();
    const { stats, isLoading, error, season, setSeason, availableSeasons } = useDashboard();

    const handleVideoPress = useCallback(
        (id: string) => {
            router.push(`/video/${id}`);
        },
        [router]
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.alpineBlue} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>⚠️</Text>
                <Text style={styles.emptyTitle}>読み込みに失敗しました</Text>
                <Text style={styles.emptyText}>{error}</Text>
            </View>
        );
    }

    if (!stats || stats.summary.totalVideoCount === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyTitle}>データがありません</Text>
                <Text style={styles.emptyText}>
                    {season.label} シーズンの動画をインポートすると{"\n"}
                    統計が表示されます
                </Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
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
                <MonthlyBarChart data={stats.monthlyTrend} />
            </DashboardSection>

            {/* アクティビティヒートマップ */}
            <DashboardSection title="アクティビティ">
                <ActivityHeatmap days={stats.heatmapDays} season={season} />
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
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.glacierWhite,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.glacierWhite,
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
