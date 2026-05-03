import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useTranslation } from "@/i18n/useTranslation";

interface BulkImportProgressProps {
    current: number;
    total: number;
    skippedCount: number;
    errorCount: number;
    currentFilename?: string;
    stepLabel?: string;
    remainingLabel?: string;
    isStopRequested: boolean;
    onRequestStop: () => void;
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
    stepLabel,
    remainingLabel,
    isStopRequested,
    onRequestStop,
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
                    {t("import.bulk.currentFile", { filename: currentFilename })}
                </Text>
            )}

            {stepLabel && <Text style={styles.stepText}>{stepLabel}</Text>}
            {remainingLabel && <Text style={styles.remainingText}>{remainingLabel}</Text>}

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

            <TouchableOpacity
                style={[
                    styles.stopButton,
                    isStopRequested && styles.stopButtonDisabled,
                ]}
                onPress={onRequestStop}
                disabled={isStopRequested}
            >
                <Text style={styles.stopButtonText}>
                    {isStopRequested
                        ? t("import.bulk.stopRequested")
                        : t("import.bulk.stopButton")}
                </Text>
            </TouchableOpacity>
            <Text style={styles.stopHint}>{t("import.bulk.stopHint")}</Text>
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
    stepText: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: "center",
        marginTop: 10,
        lineHeight: 20,
    },
    remainingText: {
        fontSize: 13,
        color: Colors.textTertiary,
        marginTop: 6,
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
    stopButton: {
        minWidth: 160,
        backgroundColor: Colors.freshSnow,
        borderWidth: 1,
        borderColor: Colors.error,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: "center",
        marginTop: 24,
    },
    stopButtonDisabled: {
        borderColor: Colors.textTertiary,
        opacity: 0.7,
    },
    stopButtonText: {
        fontSize: 14,
        fontWeight: "700",
        color: Colors.error,
    },
    stopHint: {
        fontSize: 12,
        color: Colors.textTertiary,
        textAlign: "center",
        marginTop: 8,
        lineHeight: 18,
    },
});
