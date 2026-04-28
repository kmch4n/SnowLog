import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useTranslation } from "@/i18n/useTranslation";

interface ThumbnailMigrationScreenProps {
    processed: number;
    total: number;
}

/**
 * アップデート後の初回起動で表示されるサムネイル移行画面。
 * 起動時にすべての動画のサムネイルを検証・再生成する間、
 * ユーザー操作をブロックして進捗を表示する。
 */
export function ThumbnailMigrationScreen({
    processed,
    total,
}: ThumbnailMigrationScreenProps) {
    const { t } = useTranslation();
    const ratio = total > 0 ? Math.min(processed / total, 1) : 0;
    const percent = Math.round(ratio * 100);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color={Colors.alpineBlue} />
            <Text style={styles.title}>{t("thumbnailMigration.title")}</Text>
            <Text style={styles.subtitle}>
                {t("thumbnailMigration.subtitle")}
            </Text>
            <View style={styles.progressBarTrack}>
                <View
                    style={[
                        styles.progressBarFill,
                        { width: `${percent}%` },
                    ]}
                />
            </View>
            <Text style={styles.progressText}>
                {total > 0
                    ? t("thumbnailMigration.progress", { processed, total })
                    : t("thumbnailMigration.preparing")}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 32,
        gap: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginTop: 8,
    },
    subtitle: {
        fontSize: 13,
        color: Colors.textSecondary,
        textAlign: "center",
        lineHeight: 20,
    },
    progressBarTrack: {
        width: "100%",
        height: 6,
        backgroundColor: Colors.frostGray,
        borderRadius: 3,
        marginTop: 8,
        overflow: "hidden",
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: Colors.alpineBlue,
    },
    progressText: {
        fontSize: 13,
        fontWeight: "600",
        color: Colors.textSecondary,
    },
});
