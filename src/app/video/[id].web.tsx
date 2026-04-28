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
import { useTranslation } from "@/i18n/useTranslation";
import { formatDate, formatDuration } from "@/utils/dateUtils";

export default function VideoDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const navigation = useNavigation();
    const { t, locale } = useTranslation();
    const { video, isLoading, error } = useVideoDetail(id);

    const [isExporting, setIsExporting] = useState(false);

    const handleExport = useCallback(async () => {
        setIsExporting(true);
        try {
            await exportAllToJSON();
        } catch (e) {
            Alert.alert(
                t("settings.export.failed"),
                e instanceof Error ? e.message : t("common.unknownError")
            );
        } finally {
            setIsExporting(false);
        }
    }, [t]);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity
                    onPress={handleExport}
                    style={{ marginRight: 16 }}
                    disabled={isExporting}
                >
                    <Text style={{ color: Colors.headerText, fontSize: 14 }}>
                        {isExporting ? "..." : t("settings.export.headerButton")}
                    </Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, isExporting, handleExport, t]);

    if (isLoading) {
        return (
            <View style={styles.center}>
                <Text style={styles.loadingText}>{t("common.loading")}</Text>
            </View>
        );
    }

    if (error || !video) {
        return (
            <View style={styles.center}>
                <Text style={styles.loadingText}>{error ?? t("videoDetail.notFound")}</Text>
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
                        {t("videoDetail.webPlaybackNotice")}
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
                        📅 {formatDate(video.capturedAt, locale)}　⏱ {formatDuration(video.duration, locale)}
                    </Text>

                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>{t("videoDetail.skiResortLabel")}</Text>
                        <Text style={styles.readonlyText}>
                            {video.skiResortName ?? t("videoDetail.unset")}
                        </Text>
                    </View>
                </View>

                {/* タグ */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t("videoDetail.tagsLabel")}</Text>
                    </View>
                    <View style={styles.tagList}>
                        {video.tags.length > 0 ? (
                            video.tags.map((tag) => <TagChip key={tag.id} tag={tag} />)
                        ) : (
                            <Text style={styles.emptyTag}>{t("videoDetail.noTags")}</Text>
                        )}
                    </View>
                </View>

                {/* メモ */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t("videoDetail.memoLabel")}</Text>
                    </View>
                    <Text style={styles.memoText}>
                        {video.memo || t("videoDetail.noMemo")}
                    </Text>
                </View>

                {/* iOS限定機能の案内 */}
                <View style={styles.iosNotice}>
                    <Text style={styles.iosNoticeText}>
                        {t("videoDetail.webEditNotice")}
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
