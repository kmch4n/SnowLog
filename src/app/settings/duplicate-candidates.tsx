import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
    ActivityIndicator,
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

function DuplicateGroupCard({
    group,
    onOpenVideo,
}: {
    group: DuplicateCandidateGroup;
    onOpenVideo: (id: string) => void;
}) {
    return (
        <View style={styles.groupCard}>
            <View style={styles.groupHeader}>
                <View>
                    <Text style={styles.groupTitle}>候補グループ</Text>
                    <Text style={styles.groupMeta}>
                        {group.videos.length}件 ・ スコア {group.similarityScore}
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
                            onPress={() => onOpenVideo(video.id)}
                            showResort
                        />
                        {index < group.videos.length - 1 && <View style={styles.separator} />}
                    </View>
                ))}
            </View>
        </View>
    );
}

export default function DuplicateCandidatesScreen() {
    const router = useRouter();
    const { videos, isLoading, refresh } = useVideos();

    const groups = useMemo(() => detectDuplicateCandidates(videos), [videos]);

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
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.borderLight,
        marginLeft: 16 + 72 + 12,
    },
});
