import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    InteractionManager,
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
import { useTranslation } from "@/i18n/useTranslation";
import {
    detectDuplicateCandidates,
    type DuplicateCandidateGroup,
} from "@/services/duplicateDetectionService";
import { deleteVideosWithCleanup } from "@/services/videoDeletionService";

function buildInitialSelectedIds(group: DuplicateCandidateGroup): Set<string> {
    return new Set(group.videos.slice(1).map((video) => video.id));
}

const DUPLICATE_REASON_KEYS: Record<string, string> = {
    "長さが一致": "durationExact",
    "長さの差が1秒以内": "durationWithinOne",
    "長さの差が2秒以内": "durationWithinTwo",
    "撮影時刻が一致": "capturedAtExact",
    "撮影時刻の差が5秒以内": "capturedAtWithinFive",
    "撮影時刻の差が1分以内": "capturedAtWithinMinute",
    "ファイル名がほぼ一致": "filenameNearlyExact",
    "ファイル名が似ている": "filenameSimilar",
    "スキー場名が一致": "resortExact",
    "一致条件は動画ごとに異なります": "mixed",
};

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
    const { t } = useTranslation();
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
            t("settings.duplicateCandidates.removeConfirm.title"),
            t("settings.duplicateCandidates.removeConfirm.bodyWithCount", { count: deleteIds.length }),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: () => {
                        void onDeleteSelected(group.id, deleteIds);
                    },
                },
            ]
        );
    }, [group.id, isDeleting, onDeleteSelected, selectedIds, t]);

    return (
        <View style={styles.groupCard}>
            <View style={styles.groupHeader}>
                <View>
                    <Text style={styles.groupTitle}>{t("settings.duplicateCandidates.groupTitle")}</Text>
                    <Text style={styles.groupMeta}>
                        {t("settings.duplicateCandidates.groupMeta", {
                            videoCount: group.videos.length,
                            score: group.similarityScore,
                            deleteCount: selectedIds.size,
                        })}
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
                        {group.confidence === "high"
                            ? t("settings.duplicateCandidates.confidence.high")
                            : t("settings.duplicateCandidates.confidence.medium")}
                    </Text>
                </View>
            </View>

            {group.reasons.length > 0 && (
                <View style={styles.reasonWrap}>
                    {group.reasons.map((reason) => (
                        <View key={reason} style={styles.reasonChip}>
                            <Text style={styles.reasonText}>
                                {DUPLICATE_REASON_KEYS[reason]
                                    ? t(`settings.duplicateCandidates.reasons.${DUPLICATE_REASON_KEYS[reason]}`)
                                    : reason}
                            </Text>
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
                                    {selectedIds.has(video.id)
                                        ? t("settings.duplicateCandidates.markedForDelete")
                                        : t("settings.duplicateCandidates.keepLabel")}
                                </Text>
                            </View>
                            <View style={styles.videoActionsButtons}>
                                <TouchableOpacity
                                    style={styles.inlineActionButton}
                                    onPress={() => keepOnly(video.id)}
                                    disabled={isDeleting}
                                >
                                    <Text style={styles.inlineActionText}>{t("settings.duplicateCandidates.keepThis")}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.inlineActionButton}
                                    onPress={() => onOpenVideo(video.id)}
                                    disabled={isDeleting}
                                >
                                    <Text style={styles.inlineActionText}>{t("common.detail")}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {index < group.videos.length - 1 && <View style={styles.separator} />}
                    </View>
                ))}
            </View>

            <View style={styles.groupFooter}>
                <Text style={styles.groupHint}>
                    {t("settings.duplicateCandidates.groupHint")}
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
                        <Text style={styles.deleteButtonText}>{t("settings.duplicateCandidates.deleteSelected")}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function DuplicateCandidatesScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { videos, isLoading, refresh } = useVideos();
    const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
    const [groups, setGroups] = useState<DuplicateCandidateGroup[]>([]);
    const [isComputing, setIsComputing] = useState(false);

    useEffect(() => {
        if (isLoading) {
            return;
        }

        let isCancelled = false;
        setIsComputing(true);

        const task = InteractionManager.runAfterInteractions(() => {
            const nextGroups = detectDuplicateCandidates(videos);
            if (isCancelled) {
                return;
            }

            setGroups(nextGroups);
            setIsComputing(false);
        });

        return () => {
            isCancelled = true;
            task.cancel();
        };
    }, [videos, isLoading]);

    const handleDeleteSelected = useCallback(
        async (groupId: string, videoIds: string[]) => {
            setDeletingGroupId(groupId);
            try {
                await deleteVideosWithCleanup(videoIds);
                await refresh();
            } catch (error) {
                Alert.alert(
                    t("settings.duplicateCandidates.deleteFailed"),
                    error instanceof Error
                        ? error.message
                        : t("settings.duplicateCandidates.deleteFailedBody")
                );
            } finally {
                setDeletingGroupId((current) => (current === groupId ? null : current));
            }
        },
        [refresh, t]
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
                <Text style={styles.summaryTitle}>{t("settings.duplicateCandidates.title")}</Text>
                <Text style={styles.summaryText}>
                    {t("settings.duplicateCandidates.summary")}
                </Text>
                <Text style={styles.summaryCount}>
                    {isComputing
                        ? t("settings.duplicateCandidates.scanningCount", { count: videos.length })
                        : t("settings.duplicateCandidates.summaryCount", {
                            videoCount: videos.length,
                            groupCount: groups.length,
                        })}
                </Text>
            </View>

            {isLoading || isComputing ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={Colors.alpineBlue} />
                    <Text style={styles.computingTitle}>
                        {isLoading
                            ? t("settings.duplicateCandidates.loadingVideos")
                            : t("settings.duplicateCandidates.computing")}
                    </Text>
                    <Text style={styles.computingText}>
                        {isLoading
                            ? t("settings.duplicateCandidates.loadingVideosBody")
                            : t("settings.duplicateCandidates.computingBody")}
                    </Text>
                </View>
            ) : groups.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>{t("settings.duplicateCandidates.empty")}</Text>
                    <Text style={styles.emptyText}>
                        {t("settings.duplicateCandidates.emptyBody")}
                    </Text>
                    <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
                        <Text style={styles.refreshButtonText}>{t("settings.duplicateCandidates.rescan")}</Text>
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
        gap: 10,
    },
    computingTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    computingText: {
        fontSize: 13,
        lineHeight: 20,
        textAlign: "center",
        color: Colors.textSecondary,
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
