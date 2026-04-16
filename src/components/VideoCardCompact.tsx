import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "../constants/colors";
import {
    THUMBNAIL_MISSING_SENTINEL,
    resolveThumbnailUri,
} from "../services/thumbnailService";
import type { VideoWithTags } from "../types";
import { formatDate, formatDuration } from "../utils/dateUtils";

interface VideoCardCompactProps {
    video: VideoWithTags;
    onPress: () => void;
    onLongPress?: () => void;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    showResort?: boolean;
}

/**
 * コンパクトな動画カード（横並びレイアウト）
 * ホームのスキー場別グループ表示・カレンダー画面で使用する
 * スキー場名は親のセクションヘッダーに表示されるため省略
 */
export function VideoCardCompact({
    video,
    onPress,
    onLongPress,
    isSelectionMode = false,
    isSelected = false,
    showResort = false,
}: VideoCardCompactProps) {
    const isUnavailable = video.isFileAvailable === 0;
    const isThumbnailMissing = video.thumbnailUri === THUMBNAIL_MISSING_SENTINEL;

    return (
        <TouchableOpacity
            style={[styles.container, isSelected && styles.containerSelected]}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.8}
        >
            {/* Selection checkbox */}
            {isSelectionMode && (
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
            )}

            {/* サムネイル */}
            <View style={styles.thumbnailContainer}>
                {isThumbnailMissing ? (
                    <View style={[styles.thumbnail, styles.thumbnailMissing]}>
                        <Text style={styles.thumbnailMissingIcon}>🖼️</Text>
                    </View>
                ) : (
                    <Image
                        source={{ uri: resolveThumbnailUri(video.thumbnailUri) }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                    />
                )}
                {video.isFavorite === 1 && (
                    <View style={styles.favBadge}>
                        <Text style={styles.favBadgeText}>★</Text>
                    </View>
                )}
                {isUnavailable && (
                    <View style={styles.unavailableOverlay}>
                        <Text style={styles.unavailableText}>なし</Text>
                    </View>
                )}
            </View>

            {/* メタデータ */}
            <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={1}>
                    {video.title ?? video.filename}
                </Text>
                <Text style={styles.date}>
                    {formatDate(video.capturedAt)} · {formatDuration(video.duration)}
                </Text>
                {showResort && video.skiResortName && (
                    <Text style={styles.resort} numberOfLines={1}>
                        {video.skiResortName}
                    </Text>
                )}

                {/* 滑走種別（最大2件） */}
                {video.techniques && video.techniques.length > 0 && (
                    <View style={styles.chipRow}>
                        {video.techniques.slice(0, 2).map((t) => (
                            <View key={t} style={styles.techniqueChip}>
                                <Text style={styles.techniqueChipText}>{t}</Text>
                            </View>
                        ))}
                        {video.techniques.length > 2 && (
                            <Text style={styles.moreText}>+{video.techniques.length - 2}</Text>
                        )}
                    </View>
                )}

                {/* タグ（technique 以外、最大2件） */}
                {video.tags && video.tags.filter((t) => t.type !== "technique").length > 0 && (() => {
                    const nonTechniqueTags = video.tags.filter((t) => t.type !== "technique");
                    return (
                        <View style={styles.chipRow}>
                            {nonTechniqueTags.slice(0, 2).map((tag) => (
                                <View
                                    key={tag.id}
                                    style={[styles.tagChip, Colors.tag[tag.type as keyof typeof Colors.tag] && { backgroundColor: Colors.tag[tag.type as keyof typeof Colors.tag].bg }]}
                                >
                                    <Text
                                        style={[styles.tagChipText, Colors.tag[tag.type as keyof typeof Colors.tag] && { color: Colors.tag[tag.type as keyof typeof Colors.tag].text }]}
                                    >
                                        {tag.name}
                                    </Text>
                                </View>
                            ))}
                            {nonTechniqueTags.length > 2 && (
                                <Text style={styles.moreText}>+{nonTechniqueTags.length - 2}</Text>
                            )}
                        </View>
                    );
                })()}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: "center",
        gap: 12,
    },
    containerSelected: {
        backgroundColor: Colors.alpineBlueLight,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.freshSnow,
    },
    checkboxSelected: {
        backgroundColor: Colors.alpineBlue,
        borderColor: Colors.alpineBlue,
    },
    checkmark: {
        color: Colors.headerText,
        fontSize: 14,
        fontWeight: "700",
    },
    thumbnailContainer: {
        width: 72,
        height: 54,
        borderRadius: 6,
        backgroundColor: Colors.border,
        overflow: "hidden",
        flexShrink: 0,
    },
    thumbnail: {
        width: "100%",
        height: "100%",
    },
    thumbnailMissing: {
        backgroundColor: Colors.frostGray,
        justifyContent: "center",
        alignItems: "center",
    },
    thumbnailMissingIcon: {
        fontSize: 20,
        opacity: 0.7,
    },
    favBadge: {
        position: "absolute",
        top: 2,
        left: 2,
        backgroundColor: Colors.overlayDark,
        borderRadius: 3,
        paddingHorizontal: 3,
        paddingVertical: 0,
    },
    favBadgeText: {
        color: Colors.morningGold,
        fontSize: 10,
    },
    unavailableOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.overlayLight,
        justifyContent: "center",
        alignItems: "center",
    },
    unavailableText: {
        color: Colors.headerText,
        fontSize: 10,
        fontWeight: "700",
    },
    meta: {
        flex: 1,
        gap: 3,
    },
    title: {
        fontSize: 14,
        fontWeight: "600",
        color: Colors.textPrimary,
    },
    date: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    resort: {
        fontSize: 12,
        color: Colors.alpineBlue,
        fontWeight: "600",
    },
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 2,
    },
    techniqueChip: {
        backgroundColor: Colors.tag.technique.bg,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    techniqueChipText: {
        fontSize: 11,
        color: Colors.tag.technique.text,
        fontWeight: "500",
    },
    tagChip: {
        backgroundColor: Colors.tag.custom.bg,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    tagChipText: {
        fontSize: 11,
        color: Colors.tag.custom.text,
        fontWeight: "500",
    },
    moreText: {
        fontSize: 11,
        color: Colors.textSecondary,
        alignSelf: "center",
    },
});
