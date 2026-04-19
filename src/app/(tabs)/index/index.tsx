import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    Alert,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { BulkActionToolbar } from "@/components/BulkActionToolbar";
import { VideoCardCompact } from "@/components/VideoCardCompact";
import { Colors } from "@/constants/colors";
import {
    bulkSetFavorite,
} from "@/database/repositories/videoRepository";
import { useAppPreference } from "@/hooks/useAppPreference";
import { useSelectionMode } from "@/hooks/useSelectionMode";
import { useVideos } from "@/hooks/useVideos";
import {
    hapticLight,
    hapticSelection,
    hapticWarning,
} from "@/services/hapticsService";
import { deleteVideosWithCleanup } from "@/services/videoDeletionService";
import type { FilterOptions, VideoSortOrder, VideoWithTags } from "@/types";

interface VideoSection {
    title: string;
    data: VideoWithTags[];
}

const UNSET_RESORT_LABEL = "スキー場未設定";

const SORT_ORDER_KEY = "home_sort_order";
const DEFAULT_SORT_ORDER: VideoSortOrder = "newest";

const SORT_LABELS: Record<VideoSortOrder, string> = {
    newest: "新しい順",
    oldest: "古い順",
    resort: "スキー場別",
};

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
        const key = video.skiResortName ?? UNSET_RESORT_LABEL;
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
            // 「スキー場未設定」は常に末尾
            if (a === UNSET_RESORT_LABEL) return 1;
            if (b === UNSET_RESORT_LABEL) return -1;
            return a.localeCompare(b, "ja");
        });
    }

    return entries.map(([title, data]) => ({ title, data }));
}

const TABS = [
    { key: "all", label: "すべて" },
    { key: "favorites", label: "★ お気に入り" },
] as const;

/**
 * ホーム画面
 * セグメントコントロールで「全動画」と「お気に入り」を切り替え
 */
export default function HomeScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState(0);
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

    const {
        isSelectionMode,
        selectedIds,
        selectedCount,
        enterSelectionMode,
        exitSelectionMode,
        toggleSelection,
    } = useSelectionMode();
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

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
            "動画を一括削除",
            `${selectedCount}件の動画の記録を削除しますか？\n（元の動画ファイルは削除されません）`,
            [
                { text: "キャンセル", style: "cancel" },
                {
                    text: "削除",
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
    }, [selectedIds, selectedCount, exitSelectionMode, refreshAll, refreshFav]);

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
        Alert.alert("並び順", undefined, [
            ...SORT_ORDERS.map((order) => ({
                text:
                    order === sortOrder
                        ? `✓ ${SORT_LABELS[order]}`
                        : SORT_LABELS[order],
                onPress: () => {
                    if (order !== sortOrder) setSortOrderRaw(order);
                },
            })),
            { text: "キャンセル", style: "cancel" as const },
        ]);
    }, [sortOrder, setSortOrderRaw]);

    const renderItem = useCallback(
        ({ item }: { item: VideoWithTags }) => (
            <VideoCardCompact
                video={item}
                onPress={() => handleVideoPress(item.id)}
                onLongPress={() => handleVideoLongPress(item.id)}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(item.id)}
            />
        ),
        [handleVideoPress, handleVideoLongPress, isSelectionMode, selectedIds]
    );

    const renderSectionHeader = useCallback(
        ({ section }: { section: VideoSection }) => (
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                    📍 {section.title}
                </Text>
                <Text style={styles.sectionCount}>{section.data.length}件</Text>
            </View>
        ),
        []
    );

    return (
        <View style={styles.container}>
            {/* セグメントコントロール */}
            <View style={[styles.segmentBar, isSelectionMode && styles.segmentBarDisabled]}>
                {TABS.map((tab, i) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.segmentTab, activeTab === i && styles.segmentTabActive]}
                        onPress={() => handleTabPress(i)}
                        activeOpacity={0.7}
                        disabled={isSelectionMode}
                    >
                        <Text style={[styles.segmentText, activeTab === i && styles.segmentTextActive]}>
                            {tab.label}
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
                        並び順: {SORT_LABELS[sortOrder]} ▾
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
                                <Text style={styles.emptyTitle}>動画がありません</Text>
                                <Text style={styles.emptySubtitle}>
                                    下のボタンからスキー動画をインポートしてください
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
                                <Text style={styles.emptyTitle}>お気に入りがありません</Text>
                                <Text style={styles.emptySubtitle}>
                                    動画詳細画面の ★ ボタンでお気に入りに追加しましょう
                                </Text>
                            </View>
                        )
                    }
                />
            )}

            {/* インポートFAB (hidden during selection mode) */}
            {!isSelectionMode && (
                <TouchableOpacity style={styles.fab} onPress={handleImportPress}>
                    <Text style={styles.fabText}>＋ インポート</Text>
                </TouchableOpacity>
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
    fab: {
        position: "absolute",
        bottom: 100,
        alignSelf: "center",
        backgroundColor: Colors.alpineBlue,
        borderRadius: 28,
        paddingHorizontal: 24,
        paddingVertical: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 5,
    },
    fabText: {
        color: Colors.headerText,
        fontSize: 16,
        fontWeight: "700",
    },
});
