import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { VideoWithTags } from "../types";
import { formatDate, formatDuration } from "../utils/dateUtils";

interface VideoCardCompactProps {
    video: VideoWithTags;
    onPress: () => void;
}

/**
 * コンパクトな動画カード（横並びレイアウト）
 * ホームのスキー場別グループ表示・カレンダー画面で使用する
 * スキー場名は親のセクションヘッダーに表示されるため省略
 */
export function VideoCardCompact({ video, onPress }: VideoCardCompactProps) {
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

                {/* 滑走種別（最大2件） */}
                {video.techniques && video.techniques.length > 0 && (
                    <View style={styles.techniques}>
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
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: "center",
        gap: 12,
    },
    thumbnailContainer: {
        width: 72,
        height: 54,
        borderRadius: 6,
        backgroundColor: "#E0E0E0",
        overflow: "hidden",
        flexShrink: 0,
    },
    thumbnail: {
        width: "100%",
        height: "100%",
    },
    unavailableOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    unavailableText: {
        color: "#FFFFFF",
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
        color: "#222222",
    },
    date: {
        fontSize: 12,
        color: "#888888",
    },
    techniques: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 2,
    },
    techniqueChip: {
        backgroundColor: "#E8F0FA",
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    techniqueChipText: {
        fontSize: 11,
        color: "#1A3A5C",
        fontWeight: "500",
    },
    moreText: {
        fontSize: 11,
        color: "#888888",
        alignSelf: "center",
    },
});
