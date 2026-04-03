/**
 * Web用動画詳細画面
 * expo-video はブラウザ非対応のため、動画プレイヤーをグレーのプレースホルダーに置換する
 */
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { TagChip } from "@/components/TagChip";
import { exportAllToJSON } from "@/services/exportService";
import { useVideoDetail } from "@/hooks/useVideoDetail";
import { formatDate, formatDuration } from "@/utils/dateUtils";

export default function VideoDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const navigation = useNavigation();
    const { video, isLoading, error } = useVideoDetail(id);

    const [isExporting, setIsExporting] = useState(false);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity
                    onPress={handleExport}
                    style={{ marginRight: 16 }}
                    disabled={isExporting}
                >
                    <Text style={{ color: Colors.headerText, fontSize: 14 }}>
                        {isExporting ? "..." : "書き出し"}
                    </Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, isExporting]);

    const handleExport = useCallback(async () => {
        setIsExporting(true);
        try {
            await exportAllToJSON();
        } catch (e) {
            Alert.alert("書き出し失敗", e instanceof Error ? e.message : "エラーが発生しました");
        } finally {
            setIsExporting(false);
        }
    }, []);

    if (isLoading) {
        return (
            <View style={styles.center}>
                <Text style={styles.loadingText}>読み込み中...</Text>
            </View>
        );
    }

    if (error || !video) {
        return (
            <View style={styles.center}>
                <Text style={styles.loadingText}>{error ?? "動画が見つかりません"}</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                {/* 動画プレイヤーの代わりにプレースホルダー */}
                <View style={styles.videoPlaceholder}>
                    <Text style={styles.videoPlaceholderIcon}>▶</Text>
                    <Text style={styles.videoPlaceholderText}>
                        動画再生はiOSアプリでご利用ください
                    </Text>
                </View>

                {/* メタデータ */}
                <View style={styles.metaSection}>
                    <View style={styles.titleRow}>
                        <Text style={styles.filename} numberOfLines={1}>
                            {video.filename}
                        </Text>
                        <Text style={video.isFavorite === 1 ? styles.starActive : styles.starInactive}>
                            {video.isFavorite === 1 ? "★" : "☆"}
                        </Text>
                    </View>
                    <Text style={styles.metaRow}>
                        📅 {formatDate(video.capturedAt)}　⏱ {formatDuration(video.duration)}
                    </Text>

                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>スキー場</Text>
                        <Text style={styles.readonlyText}>
                            {video.skiResortName ?? "未設定"}
                        </Text>
                    </View>
                </View>

                {/* タグ */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>タグ</Text>
                    </View>
                    <View style={styles.tagList}>
                        {video.tags.length > 0 ? (
                            video.tags.map((tag) => <TagChip key={tag.id} tag={tag} />)
                        ) : (
                            <Text style={styles.emptyTag}>タグなし</Text>
                        )}
                    </View>
                </View>

                {/* メモ */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>メモ</Text>
                    </View>
                    <Text style={styles.memoText}>
                        {video.memo || "メモなし"}
                    </Text>
                </View>

                {/* iOS限定機能の案内 */}
                <View style={styles.iosNotice}>
                    <Text style={styles.iosNoticeText}>
                        ✏️ メモ・タグ・スキー場の編集は iOS アプリでのみ利用できます
                    </Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    scroll: {
        paddingBottom: 40,
    },
    videoPlaceholder: {
        width: "100%",
        height: 240,
        backgroundColor: "#2C2C2C",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
    },
    videoPlaceholderIcon: {
        fontSize: 40,
        color: Colors.headerText,
        opacity: 0.4,
    },
    videoPlaceholderText: {
        color: Colors.textTertiary,
        fontSize: 13,
    },
    metaSection: {
        backgroundColor: Colors.freshSnow,
        padding: 16,
        marginBottom: 8,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    filename: {
        flex: 1,
        fontSize: 16,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    starActive: {
        fontSize: 20,
        color: Colors.morningGold,
        marginLeft: 8,
    },
    starInactive: {
        fontSize: 20,
        color: Colors.textTertiary,
        marginLeft: 8,
    },
    metaRow: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginBottom: 12,
    },
    fieldSection: {
        marginTop: 4,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: Colors.textSecondary,
        marginBottom: 6,
    },
    section: {
        backgroundColor: Colors.freshSnow,
        padding: 16,
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    tagList: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    emptyTag: {
        fontSize: 14,
        color: Colors.textTertiary,
    },
    memoText: {
        fontSize: 15,
        color: Colors.textPrimary,
        lineHeight: 22,
    },
    readonlyText: {
        fontSize: 15,
        color: Colors.textPrimary,
    },
    iosNotice: {
        margin: 16,
        padding: 12,
        backgroundColor: Colors.alpineBlueLight,
        borderRadius: 8,
    },
    iosNoticeText: {
        fontSize: 13,
        color: Colors.alpineBlue,
        textAlign: "center",
    },
});
