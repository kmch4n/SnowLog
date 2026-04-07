import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { VideoCardCompact } from "@/components/VideoCardCompact";
import { Colors } from "@/constants/colors";
import { useVideos } from "@/hooks/useVideos";
import {
    detectDuplicateCandidates,
    type DuplicateCandidateGroup,
} from "@/services/duplicateDetectionService";
import { deleteVideosWithCleanup } from "@/services/videoDeletionService";

function buildInitialSelectedIds(group: DuplicateCandidateGroup): Set<string> {
    return new Set(group.videos.slice(1).map((video) => video.id));
}

function DuplicateGroupCard({
    group,
    isDeleting,
    onDeleteSelected,
    onOpenVideo,
}: {
    group: DuplicateCandidateGroup;
    isDeleting: boolean;
    onDeleteSelected: (groupId: string, videoIds: string[]) => Promise<void>;
    onOpenVideo: (id: string) => void;
}) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => buildInitialSelectedIds(group));

    useEffect(() => {
        setSelectedIds(buildInitialSelectedIds(group));
    }, [group]);

    const toggleSelection = useCallback((videoId: string) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(videoId)) {
                next.delete(videoId);
            } else {
                next.add(videoId);
            }
            return next;
        });
    }, []);

    const keepOnly = useCallback((videoId: string) => {
        setSelectedIds(new Set(group.videos.filter((video) => video.id !== videoId).map((video) => video.id)));
    }, [group.videos]);

    const handleDeletePress = useCallback(() => {
        const deleteIds = Array.from(selectedIds);
        if (deleteIds.length === 0 || isDeleting) {
            return;
        }

        Alert.alert(
            "重複候補を削除",
            `${deleteIds.length}件の動画の記録を削除しますか？\n（元の動画ファイルは削除されません）`,
            [
                { text: "キャンセル", style: "cancel" },
                {
                    text: "削除",
                    style: "destructive",
                    onPress: () => {
                        void onDeleteSelected(group.id, deleteIds);
                    },
                },
            ]
        );
    }, [group.id, isDeleting, onDeleteSelected, selectedIds]);

    return (
        <View style={styles.groupCard}>
            <View style={styles.groupHeader}>
                <View>
                    <Text style={styles.groupTitle}>候補グループ</Text>
                    <Text style={styles.groupMeta}>
                        {group.videos.length}件 ・ スコア {group.similarityScore} ・ 削除予定 {selectedIds.size}件
                    </Text>
                </View>
                <View
                    style={[
                        styles.confidenceBadge,
                        group.confidence === "high"
                            ? styles.confidenceBadgeHigh
                            : styles.confidenceBadgeMedium,
                    ]}
                >
                    <Text style={styles.confidenceText}>
                        {group.confidence === "high" ? "高" : "中"}
                    </Text>
                </View>
            </View>

            {group.reasons.length > 0 && (
                <View style={styles.reasonWrap}>
                    {group.reasons.map((reason) => (
                        <View key={reason} style={styles.reasonChip}>
                            <Text style={styles.reasonText}>{reason}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.videosWrap}>
                {group.videos.map((video, index) => (
                    <View key={video.id}>
                        <VideoCardCompact
                            video={video}
                            onPress={() => toggleSelection(video.id)}
                            isSelectionMode
                            isSelected={selectedIds.has(video.id)}
                            showResort
                        />
                        <View style={styles.videoActionsRow}>
                            <View
                                style={[
                                    styles.selectionBadge,
                                    selectedIds.has(video.id)
                                        ? styles.selectionBadgeDelete
                                        : styles.selectionBadgeKeep,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.selectionBadgeText,
                                        selectedIds.has(video.id)
                                            ? styles.selectionBadgeTextDelete
                                            : styles.selectionBadgeTextKeep,
                                    ]}
                                >
                                    {selectedIds.has(video.id) ? "削除予定" : "残す"}
                                </Text>
                            </View>
                            <View style={styles.videoActionsButtons}>
                                <TouchableOpacity
                                    style={styles.inlineActionButton}
                                    onPress={() => keepOnly(video.id)}
                                    disabled={isDeleting}
                                >
                                    <Text style={styles.inlineActionText}>これを残す</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.inlineActionButton}
                                    onPress={() => onOpenVideo(video.id)}
                                    disabled={isDeleting}
                                >
                                    <Text style={styles.inlineActionText}>詳細</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {index < group.videos.length - 1 && <View style={styles.separator} />}
                    </View>
                ))}
            </View>

            <View style={styles.groupFooter}>
                <Text style={styles.groupHint}>
                    先頭以外を削除候補として選択しています。タップで切り替えできます。
                </Text>
                <TouchableOpacity
                    style={[
                        styles.deleteButton,
                        (selectedIds.size === 0 || isDeleting) && styles.deleteButtonDisabled,
                    ]}
                    onPress={handleDeletePress}
                    disabled={selectedIds.size === 0 || isDeleting}
                >
                    {isDeleting ? (
                        <ActivityIndicator size="small" color={Colors.headerText} />
                    ) : (
                        <Text style={styles.deleteButtonText}>選択した動画を削除</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function DuplicateCandidatesScreen() {
    const router = useRouter();
    const { videos, isLoading, refresh } = useVideos();
    const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

    const groups = useMemo(() => detectDuplicateCandidates(videos), [videos]);

    const handleDeleteSelected = useCallback(
        async (groupId: string, videoIds: string[]) => {
            setDeletingGroupId(groupId);
            try {
                await deleteVideosWithCleanup(videoIds);
                await refresh();
            } catch (error) {
                Alert.alert(
                    "削除に失敗しました",
                    error instanceof Error
                        ? error.message
                        : "重複候補の削除中にエラーが発生しました。"
                );
            } finally {
                setDeletingGroupId((current) => (current === groupId ? null : current));
            }
        },
        [refresh]
    );

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={(
                <RefreshControl refreshing={isLoading} onRefresh={refresh} />
            )}
        >
            <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>重複候補</Text>
                <Text style={styles.summaryText}>
                    撮影時刻、長さ、ファイル名、スキー場名が近い動画を候補として表示します。
                </Text>
                <Text style={styles.summaryCount}>
                    {videos.length}件中 {groups.length}グループ
                </Text>
            </View>

            {isLoading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={Colors.alpineBlue} />
                </View>
            ) : groups.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>重複候補は見つかりませんでした</Text>
                    <Text style={styles.emptyText}>
                        現在の判定条件では確認が必要な組み合わせはありません。
                    </Text>
                    <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
                        <Text style={styles.refreshButtonText}>再スキャン</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.groupsWrap}>
                    {groups.map((group) => (
                        <DuplicateGroupCard
                            key={group.id}
                            group={group}
                            isDeleting={deletingGroupId === group.id}
                            onDeleteSelected={handleDeleteSelected}
                            onOpenVideo={(id) => router.push(`/video/${id}`)}
                        />
                    ))}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
        gap: 16,
    },
    summaryCard: {
        backgroundColor: Colors.freshSnow,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 6,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    summaryText: {
        fontSize: 13,
        lineHeight: 20,
        color: Colors.textSecondary,
    },
    summaryCount: {
        fontSize: 12,
        fontWeight: "600",
        color: Colors.alpineBlue,
    },
    centerState: {
        paddingVertical: 48,
        alignItems: "center",
    },
    emptyState: {
        backgroundColor: Colors.freshSnow,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: "center",
        gap: 8,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    emptyText: {
        fontSize: 13,
        lineHeight: 20,
        textAlign: "center",
        color: Colors.textSecondary,
    },
    refreshButton: {
        marginTop: 8,
        backgroundColor: Colors.alpineBlue,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    refreshButtonText: {
        color: Colors.headerText,
        fontSize: 14,
        fontWeight: "600",
    },
    groupsWrap: {
        gap: 16,
    },
    groupCard: {
        backgroundColor: Colors.freshSnow,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: "hidden",
    },
    groupHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: 16,
        gap: 12,
    },
    groupTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    groupMeta: {
        marginTop: 4,
        fontSize: 12,
        color: Colors.textSecondary,
    },
    confidenceBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    confidenceBadgeHigh: {
        backgroundColor: Colors.alpineBlueLight,
    },
    confidenceBadgeMedium: {
        backgroundColor: Colors.frostGray,
    },
    confidenceText: {
        fontSize: 11,
        fontWeight: "700",
        color: Colors.textPrimary,
        textTransform: "uppercase",
    },
    reasonWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    reasonChip: {
        backgroundColor: Colors.glacierWhite,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    reasonText: {
        fontSize: 11,
        color: Colors.textSecondary,
    },
    videosWrap: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.borderLight,
    },
    videoActionsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 12,
    },
    selectionBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    selectionBadgeKeep: {
        backgroundColor: Colors.alpineBlueLight,
    },
    selectionBadgeDelete: {
        backgroundColor: "#FDECEC",
    },
    selectionBadgeText: {
        fontSize: 11,
        fontWeight: "600",
    },
    selectionBadgeTextKeep: {
        color: Colors.alpineBlue,
    },
    selectionBadgeTextDelete: {
        color: Colors.error,
    },
    videoActionsButtons: {
        flexDirection: "row",
        gap: 8,
    },
    inlineActionButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.glacierWhite,
    },
    inlineActionText: {
        fontSize: 12,
        fontWeight: "600",
        color: Colors.textSecondary,
    },
    groupFooter: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.borderLight,
        padding: 16,
        gap: 12,
    },
    groupHint: {
        fontSize: 12,
        lineHeight: 18,
        color: Colors.textSecondary,
    },
    deleteButton: {
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        backgroundColor: Colors.error,
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    deleteButtonDisabled: {
        opacity: 0.45,
    },
    deleteButtonText: {
        fontSize: 14,
        fontWeight: "700",
        color: Colors.headerText,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.borderLight,
        marginLeft: 16 + 72 + 12,
    },
});
