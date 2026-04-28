import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useTranslation } from "@/i18n/useTranslation";

interface BulkImportProgressProps {
    current: number;
    total: number;
    skippedCount: number;
    errorCount: number;
    currentFilename?: string;
}

/**
 * 一括インポートのプログレス表示
 */
export function BulkImportProgress({
    current,
    total,
    skippedCount,
    errorCount,
    currentFilename,
}: BulkImportProgressProps) {
    const { t } = useTranslation();
    const progress = total > 0 ? current / total : 0;

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color={Colors.alpineBlue} style={styles.spinner} />

            <Text style={styles.title}>{t("import.bulk.progressTitle")}</Text>
            <Text style={styles.count}>
                {t("import.bulk.progressLabel", { current, total })}
            </Text>

            {/* プログレスバー */}
            <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>

            {currentFilename && (
                <Text style={styles.filename} numberOfLines={1}>
                    {currentFilename}
                </Text>
            )}

            {/* スキップ・エラーカウント */}
            <View style={styles.statsRow}>
                {skippedCount > 0 && (
                    <Text style={styles.statText}>
                        {t("import.bulk.skippedAlreadyImported", { count: skippedCount })}
                    </Text>
                )}
                {errorCount > 0 && (
                    <Text style={[styles.statText, styles.errorText]}>
                        {t("import.bulk.summaryError", { count: errorCount })}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    spinner: {
        marginBottom: 24,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    count: {
        fontSize: 15,
        color: Colors.textSecondary,
        marginBottom: 20,
    },
    barBackground: {
        width: "100%",
        height: 8,
        backgroundColor: Colors.frostGray,
        borderRadius: 4,
        overflow: "hidden",
    },
    barFill: {
        height: "100%",
        backgroundColor: Colors.alpineBlue,
        borderRadius: 4,
    },
    filename: {
        fontSize: 13,
        color: Colors.textTertiary,
        marginTop: 12,
        maxWidth: "100%",
    },
    statsRow: {
        marginTop: 16,
        alignItems: "center",
        gap: 4,
    },
    statText: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    errorText: {
        color: Colors.error,
    },
});
