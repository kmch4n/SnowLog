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
    deleteVideos,
    getVideoById,
} from "@/database/repositories/videoRepository";
import { useSelectionMode } from "@/hooks/useSelectionMode";
import { useVideos } from "@/hooks/useVideos";
import { deleteManagedVideoFile } from "@/services/managedVideoFileService";
import { isSyntheticAssetId } from "@/services/mediaService";
import { deleteThumbnail } from "@/services/thumbnailService";
import type { VideoWithTags } from "@/types";

interface VideoSection {
    title: string;
    data: VideoWithTags[];
}

/** スキー場別にグループ化し、最新動画が新しい順にセクションを並べる */
function buildSections(videos: VideoWithTags[]): VideoSection[] {
    const map = new Map<string, VideoWithTags[]>();
    for (const video of videos) {
        const key = video.skiResortName ?? "スキー場未設定";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(video);
    }
    return Array.from(map.entries())
        .sort((a, b) => (b[1][0]?.capturedAt ?? 0) - (a[1][0]?.capturedAt ?? 0))
        .map(([title, data]) => ({ title, data }));
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

    const { videos: allVideos, isLoading: allLoading, refresh: refreshAll } = useVideos();
    const { videos: favVideos, isLoading: favLoading, refresh: refreshFav } = useVideos({ favoritesOnly: true });

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
                        setIsBulkProcessing(true);
                        try {
                            const ids = Array.from(selectedIds);
                            const targets = await Promise.all(
                                ids.map((id) => getVideoById(id))
                            );
                            await Promise.allSettled(
                                targets
                                    .filter(
                                        (v): v is NonNullable<typeof v> => v !== null
                                    )
                                    .flatMap((v) => {
                                        const tasks: Promise<void>[] = [];
                                        if (v.thumbnailUri) {
                                            tasks.push(deleteThumbnail(v.thumbnailUri));
                                        }
                                        if (isSyntheticAssetId(v.assetId)) {
                                            tasks.push(
                                                deleteManagedVideoFile(v.id, v.filename)
                                            );
                                        }
                                        return tasks;
                                    })
                            );
                            await deleteVideos(ids);
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

    const allSections = useMemo(() => buildSections(allVideos), [allVideos]);
    const favSections = useMemo(() => buildSections(favVideos), [favVideos]);

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
                        onPress={() => setActiveTab(i)}
                        activeOpacity={0.7}
                        disabled={isSelectionMode}
                    >
                        <Text style={[styles.segmentText, activeTab === i && styles.segmentTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
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
                    onRefresh={refreshAll}
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
                    onRefresh={refreshFav}
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
