import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "../constants/colors";
import type { VideoWithTags } from "../types";
import { formatDate, formatDuration } from "../utils/dateUtils";
import { TagChip } from "./TagChip";

interface VideoCardProps {
    video: VideoWithTags;
    onPress: () => void;
}

/**
 * 動画一覧に表示するカード
 * サムネイル + 日付・スキー場名・タグを表示する
 */
export function VideoCard({ video, onPress }: VideoCardProps) {
    const isUnavailable = video.isFileAvailable === 0;

    return (
        <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
            {/* サムネイル */}
            <View style={styles.thumbnailContainer}>
                <Image
                    source={{ uri: video.thumbnailUri }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                />
                {/* 再生時間バッジ */}
                <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
                </View>
                {/* お気に入りバッジ */}
                {video.isFavorite === 1 && (
                    <View style={styles.favBadge}>
                        <Text style={styles.favBadgeText}>★</Text>
                    </View>
                )}
                {/* フ���イル削除済みの警告 */}
                {isUnavailable && (
                    <View style={styles.unavailableOverlay}>
                        <Text style={styles.unavailableText}>ファイルなし</Text>
                    </View>
                )}
            </View>

            {/* メタデータ */}
            <View style={styles.meta}>
                <Text style={styles.date}>{formatDate(video.capturedAt)}</Text>
                {/* タイトル（未設定時はfilenameにフォールバック） */}
                <Text style={styles.title} numberOfLines={1}>
                    {video.title ?? video.filename}
                </Text>
                {video.skiResortName ? (
                    <Text style={styles.resort}>{video.skiResortName}</Text>
                ) : (
                    <Text style={styles.resortEmpty}>スキー場未設定</Text>
                )}

                {/* タグ一覧（technique タグは TechniqueSelector で管理するため除外） */}
                {video.tags.filter((t) => t.type !== "technique").length > 0 && (
                    <View style={styles.tags}>
                        {video.tags
                            .filter((t) => t.type !== "technique")
                            .slice(0, 4)
                            .map((tag) => (
                                <TagChip key={tag.id} tag={tag} />
                            ))}
                        {video.tags.filter((t) => t.type !== "technique").length > 4 && (
                            <Text style={styles.moreTag}>
                                +{video.tags.filter((t) => t.type !== "technique").length - 4}
                            </Text>
                        )}
                    </View>
                )}

                {/* メモのプレビュー */}
                {video.memo ? (
                    <Text style={styles.memo} numberOfLines={2}>
                        {video.memo}
                    </Text>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.freshSnow,
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
        overflow: "hidden",
    },
    thumbnailContainer: {
        position: "relative",
        width: "100%",
        height: 180,
        backgroundColor: Colors.border,
    },
    thumbnail: {
        width: "100%",
        height: "100%",
    },
    durationBadge: {
        position: "absolute",
        bottom: 8,
        right: 8,
        backgroundColor: Colors.overlayDark,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    durationText: {
        color: Colors.headerText,
        fontSize: 12,
        fontWeight: "600",
    },
    favBadge: {
        position: "absolute",
        top: 8,
        left: 8,
        backgroundColor: Colors.overlayDark,
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    favBadgeText: {
        color: Colors.morningGold,
        fontSize: 14,
    },
    unavailableOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.overlayLight,
        justifyContent: "center",
        alignItems: "center",
    },
    unavailableText: {
        color: Colors.headerText,
        fontSize: 14,
        fontWeight: "700",
    },
    meta: {
        padding: 12,
    },
    date: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    title: {
        fontSize: 15,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    resort: {
        fontSize: 16,
        fontWeight: "600",
        color: Colors.alpineBlue,
        marginBottom: 6,
    },
    resortEmpty: {
        fontSize: 14,
        color: Colors.textTertiary,
        marginBottom: 6,
    },
    tags: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        marginBottom: 6,
    },
    moreTag: {
        fontSize: 12,
        color: Colors.textSecondary,
        alignSelf: "center",
    },
    memo: {
        fontSize: 13,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
});
