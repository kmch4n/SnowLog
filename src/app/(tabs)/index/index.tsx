import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    Alert,
    InteractionManager,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { BulkActionToolbar } from "@/components/BulkActionToolbar";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { VideoCardCompact } from "@/components/VideoCardCompact";
import { Colors } from "@/constants/colors";
import {
    bulkSetFavorite,
} from "@/database/repositories/videoRepository";
import { useAppPreference } from "@/hooks/useAppPreference";
import { useSelectionMode } from "@/hooks/useSelectionMode";
import { useVideos } from "@/hooks/useVideos";
import { useTranslation } from "@/i18n/useTranslation";
import {
    hapticError,
    hapticLight,
    hapticSelection,
    hapticWarning,
} from "@/services/hapticsService";
import { consumePendingBulkImportSummary } from "@/services/bulkImportSummaryService";
import { deleteVideosWithCleanup } from "@/services/videoDeletionService";
import type { FilterOptions, VideoSortOrder, VideoWithTags } from "@/types";

interface VideoSection {
    title: string;
    data: VideoWithTags[];
}

/** Stable sentinel used to bucket videos with no ski resort assigned. Must not collide with any real resort name. */
const UNSET_RESORT_SENTINEL = "__SNOWLOG_UNSET_RESORT__";

const SORT_ORDER_KEY = "home_sort_order";
const DEFAULT_SORT_ORDER: VideoSortOrder = "newest";

const SORT_ORDERS: VideoSortOrder[] = ["newest", "oldest", "resort"];

function isVideoSortOrder(value: string): value is VideoSortOrder {
    return (SORT_ORDERS as string[]).includes(value);
}

/**
 * 動画をスキー場別にセクション化する。
 *
 * 3 種の並び順を同じデータ構造に適用する:
 *   - "newest": セクション内 capturedAt desc、セクション順はセクション最新 capturedAt desc
 *   - "oldest": セクション内 capturedAt asc、セクション順はセクション最古 capturedAt asc
 *   - "resort": セクション名の localeCompare 昇順（「スキー場未設定」は末尾）、
 *               セクション内は capturedAt desc を維持
 */
function buildSections(
    videos: VideoWithTags[],
    sortOrder: VideoSortOrder
): VideoSection[] {
    const map = new Map<string, VideoWithTags[]>();
    for (const video of videos) {
        const key = video.skiResortName ?? UNSET_RESORT_SENTINEL;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(video);
    }

    // useVideos は常に capturedAt desc の順でレコードを返す想定
    if (sortOrder === "oldest") {
        for (const list of map.values()) {
            list.reverse();
        }
    }

    const entries = Array.from(map.entries());
    if (sortOrder === "newest") {
        entries.sort(
            (a, b) => (b[1][0]?.capturedAt ?? 0) - (a[1][0]?.capturedAt ?? 0)
        );
    } else if (sortOrder === "oldest") {
        entries.sort(
            (a, b) => (a[1][0]?.capturedAt ?? 0) - (b[1][0]?.capturedAt ?? 0)
        );
    } else {
        entries.sort(([a], [b]) => {
            // unset bucket sinks to the bottom regardless of locale
            if (a === UNSET_RESORT_SENTINEL) return 1;
            if (b === UNSET_RESORT_SENTINEL) return -1;
            return a.localeCompare(b, "ja");
        });
    }

    return entries.map(([title, data]) => ({ title, data }));
}

const TAB_KEYS = ["all", "favorites"] as const;

/**
 * ホーム画面
 * セグメントコントロールで「全動画」と「お気に入り」を切り替え
 */
export default function HomeScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(0);

    const sortLabels: Record<VideoSortOrder, string> = useMemo(
        () => ({
            newest: t("home.sort.newest"),
            oldest: t("home.sort.oldest"),
            resort: t("home.sort.resort"),
        }),
        [t]
    );

    const tabLabels = useMemo(
        () => [t("home.tabs.all"), t("home.tabs.favorites")],
        [t]
    );
    const favoritesFilter = useMemo<FilterOptions>(() => ({ favoritesOnly: true }), []);

    const [sortOrderRaw, setSortOrderRaw] = useAppPreference(
        SORT_ORDER_KEY,
        DEFAULT_SORT_ORDER
    );
    const sortOrder: VideoSortOrder = isVideoSortOrder(sortOrderRaw)
        ? sortOrderRaw
        : DEFAULT_SORT_ORDER;

    const { videos: allVideos, isLoading: allLoading, refresh: refreshAll } = useVideos();
    const { videos: favVideos, isLoading: favLoading, refresh: refreshFav } = useVideos(favoritesFilter);

    useFocusEffect(
        useCallback(() => {
            const summary = consumePendingBulkImportSummary();
            if (!summary) return undefined;

            const task = InteractionManager.runAfterInteractions(() => {
                const parts: string[] = [
                    t("import.bulk.summarySuccess", { count: summary.successCount }),
                ];
                if (summary.skippedCount > 0) {
                    parts.push(t("import.bulk.summarySkipped", { count: summary.skippedCount }));
                }
                if (summary.errorCount > 0) {
                    parts.push(t("import.bulk.summaryError", { count: summary.errorCount }));
                }

                Alert.alert(t("import.bulk.summaryTitle"), parts.join("\n"));
            });

            return () => task.cancel();
        }, [t])
    );

    const {
        isSelectionMode,
        selectedIds,
        selectedCount,
        enterSelectionMode,
        exitSelectionMode,
        toggleSelection,
    } = useSelectionMode();
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

    const currentVideos = activeTab === 0 ? allVideos : favVideos;

    const handleVideoPress = useCallback(
        (id: string) => {
            if (isSelectionMode) {
                toggleSelection(id);
            } else {
                router.push(`/video/${id}`);
            }
        },
        [router, isSelectionMode, toggleSelection]
    );

    const handleVideoLongPress = useCallback(
        (id: string) => {
            if (!isSelectionMode) {
                enterSelectionMode(id);
            }
        },
        [isSelectionMode, enterSelectionMode]
    );

    const handleImportPress = useCallback(() => {
        router.push("/video-import");
    }, [router]);

    const handleBulkFavorite = useCallback(async () => {
        hapticLight();
        setIsBulkProcessing(true);
        try {
            const selectedVideos = currentVideos.filter((v) => selectedIds.has(v.id));
            const allFavorited = selectedVideos.every((v) => v.isFavorite === 1);
            await bulkSetFavorite(Array.from(selectedIds), !allFavorited);
            exitSelectionMode();
            refreshAll();
            refreshFav();
        } finally {
            setIsBulkProcessing(false);
        }
    }, [selectedIds, currentVideos, exitSelectionMode, refreshAll, refreshFav]);

    const handleBulkDelete = useCallback(() => {
        Alert.alert(
            t("home.bulkDelete.title"),
            t("home.bulkDelete.body", { count: selectedCount }),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: async () => {
                        hapticWarning();
                        setIsBulkProcessing(true);
                        try {
                            await deleteVideosWithCleanup(Array.from(selectedIds));
                            exitSelectionMode();
                            refreshAll();
                            refreshFav();
                        } finally {
                            setIsBulkProcessing(false);
                        }
                    },
                },
            ]
        );
    }, [t, selectedIds, selectedCount, exitSelectionMode, refreshAll, refreshFav]);

    const handleSwipeDelete = useCallback(
        (video: VideoWithTags) => {
            Alert.alert(
                t("home.swipeDelete.title"),
                t("home.swipeDelete.body", { name: video.title ?? video.filename }),
                [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                        text: t("common.delete"),
                        style: "destructive",
                        onPress: async () => {
                            hapticWarning();
                            setDeletingVideoId(video.id);
                            try {
                                await deleteVideosWithCleanup([video.id]);
                                refreshAll();
                                refreshFav();
                            } catch {
                                hapticError();
                                Alert.alert(
                                    t("home.swipeDelete.deleteFailedTitle"),
                                    t("home.swipeDelete.deleteFailedBody")
                                );
                            } finally {
                                setDeletingVideoId(null);
                            }
                        },
                    },
                ]
            );
        },
        [t, refreshAll, refreshFav]
    );

    const handleTabPress = useCallback(
        (index: number) => {
            if (index === activeTab) return;
            hapticSelection();
            setActiveTab(index);
        },
        [activeTab]
    );

    const handleRefreshAll = useCallback(() => {
        hapticLight();
        refreshAll();
    }, [refreshAll]);

    const handleRefreshFav = useCallback(() => {
        hapticLight();
        refreshFav();
    }, [refreshFav]);

    const allSections = useMemo(
        () => buildSections(allVideos, sortOrder),
        [allVideos, sortOrder]
    );
    const favSections = useMemo(
        () => buildSections(favVideos, sortOrder),
        [favVideos, sortOrder]
    );

    const handleOpenSortPicker = useCallback(() => {
        Alert.alert(t("home.sort.label"), undefined, [
            ...SORT_ORDERS.map((order) => ({
                text:
                    order === sortOrder
                        ? t("home.sort.checked", { label: sortLabels[order] })
                        : sortLabels[order],
                onPress: () => {
                    if (order !== sortOrder) setSortOrderRaw(order);
                },
            })),
            { text: t("common.cancel"), style: "cancel" as const },
        ]);
    }, [t, sortLabels, sortOrder, setSortOrderRaw]);

    const renderItem = useCallback(
        ({ item }: { item: VideoWithTags }) => (
            <VideoCardCompact
                video={item}
                onPress={() => handleVideoPress(item.id)}
                onLongPress={() => handleVideoLongPress(item.id)}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(item.id)}
                onSwipeDelete={() => handleSwipeDelete(item)}
                isSwipeDeleteDisabled={isBulkProcessing || deletingVideoId !== null}
            />
        ),
        [
            deletingVideoId,
            handleSwipeDelete,
            handleVideoPress,
            handleVideoLongPress,
            isBulkProcessing,
            isSelectionMode,
            selectedIds,
        ]
    );

    const renderSectionHeader = useCallback(
        ({ section }: { section: VideoSection }) => {
            const displayTitle =
                section.title === UNSET_RESORT_SENTINEL
                    ? t("home.unsetResort")
                    : section.title;
            return (
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        {t("home.sectionHeader", { name: displayTitle })}
                    </Text>
                    <Text style={styles.sectionCount}>
                        {t("home.sectionCount", { count: section.data.length })}
                    </Text>
                </View>
            );
        },
        [t]
    );

    return (
        <View style={styles.container}>
            {/* セグメントコントロール */}
            <View style={[styles.segmentBar, isSelectionMode && styles.segmentBarDisabled]}>
                {TAB_KEYS.map((key, i) => (
                    <TouchableOpacity
                        key={key}
                        style={[styles.segmentTab, activeTab === i && styles.segmentTabActive]}
                        onPress={() => handleTabPress(i)}
                        activeOpacity={0.7}
                        disabled={isSelectionMode}
                    >
                        <Text style={[styles.segmentText, activeTab === i && styles.segmentTextActive]}>
                            {tabLabels[i]}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ソートピッカー */}
            <View style={styles.sortBar}>
                <TouchableOpacity
                    style={styles.sortChip}
                    onPress={handleOpenSortPicker}
                    activeOpacity={0.7}
                    disabled={isSelectionMode}
                >
                    <Text style={styles.sortChipText}>
                        {t("home.sort.current", { label: sortLabels[sortOrder] })}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* タブコンテンツ */}
            {activeTab === 0 ? (
                <SectionList
                    sections={allSections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    renderSectionFooter={() => <View style={styles.sectionFooter} />}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    onRefresh={handleRefreshAll}
                    refreshing={allLoading && allVideos.length > 0}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        allLoading ? null : (
                            <View style={styles.empty}>
                                <Text style={styles.emptyTitle}>{t("home.empty.videosTitle")}</Text>
                                <Text style={styles.emptySubtitle}>
                                    {t("home.empty.videosSubtitle")}
                                </Text>
                            </View>
                        )
                    }
                />
            ) : (
                <SectionList
                    sections={favSections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    renderSectionFooter={() => <View style={styles.sectionFooter} />}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    onRefresh={handleRefreshFav}
                    refreshing={favLoading && favVideos.length > 0}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        favLoading ? null : (
                            <View style={styles.empty}>
                                <Text style={styles.emptyTitle}>{t("home.empty.favoritesTitle")}</Text>
                                <Text style={styles.emptySubtitle}>
                                    {t("home.empty.favoritesSubtitle")}
                                </Text>
                            </View>
                        )
                    }
                />
            )}

            {/* インポートFAB (hidden during selection mode) */}
            {!isSelectionMode && (
                <View style={styles.fabShadow}>
                    <GlassSurface variant="fab" style={styles.fab}>
                        <TouchableOpacity
                            style={styles.fabTouch}
                            onPress={handleImportPress}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.fabText}>{t("home.importFab")}</Text>
                        </TouchableOpacity>
                    </GlassSurface>
                </View>
            )}

            {/* Bulk action toolbar */}
            {isSelectionMode && (
                <BulkActionToolbar
                    selectedCount={selectedCount}
                    onToggleFavorite={handleBulkFavorite}
                    onDelete={handleBulkDelete}
                    onCancel={exitSelectionMode}
                    isProcessing={isBulkProcessing}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
    },
    segmentBar: {
        flexDirection: "row",
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    segmentBarDisabled: {
        opacity: 0.5,
    },
    segmentTab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: "center",
        backgroundColor: Colors.frostGray,
    },
    segmentTabActive: {
        backgroundColor: Colors.alpineBlue,
    },
    segmentText: {
        fontSize: 14,
        fontWeight: "600",
        color: Colors.textSecondary,
    },
    segmentTextActive: {
        color: Colors.headerText,
    },
    sortBar: {
        flexDirection: "row",
        justifyContent: "flex-end",
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    sortChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    sortChipText: {
        fontSize: 12,
        color: Colors.alpineBlue,
        fontWeight: "600",
    },
    listContent: {
        paddingBottom: 100,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.glacierWhite,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 6,
    },
    sectionTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    sectionCount: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    sectionFooter: {
        height: 8,
        backgroundColor: Colors.glacierWhite,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.borderLight,
        marginLeft: 16 + 72 + 12,
    },
    empty: {
        flex: 1,
        alignItems: "center",
        paddingTop: 80,
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: "center",
        lineHeight: 20,
    },
    fabShadow: {
        position: "absolute",
        bottom: 100,
        alignSelf: "center",
        borderRadius: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 5,
    },
    fab: {
        borderRadius: 28,
        overflow: "hidden",
    },
    fabTouch: {
        paddingHorizontal: 24,
        paddingVertical: 14,
    },
    fabText: {
        color: Colors.headerText,
        fontSize: 16,
        fontWeight: "700",
    },
});
