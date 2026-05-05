import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { Colors } from "../constants/colors";
import { useTranslation } from "../i18n/useTranslation";
import { GlassSurface } from "./ui/GlassSurface";

interface BulkActionToolbarProps {
    selectedCount: number;
    onToggleFavorite: () => void;
    onDelete: () => void;
    onCancel: () => void;
    isProcessing: boolean;
}

/**
 * Bottom toolbar shown during bulk selection mode.
 * Provides favorite toggle, delete, and cancel actions.
 */
export function BulkActionToolbar({
    selectedCount,
    onToggleFavorite,
    onDelete,
    onCancel,
    isProcessing,
}: BulkActionToolbarProps) {
    const { t } = useTranslation();

    return (
        <GlassSurface variant="toolbar" style={styles.container}>
            {isProcessing ? (
                <View style={styles.processingRow}>
                    <ActivityIndicator size="small" color={Colors.alpineBlue} />
                    <Text style={styles.processingText}>{t("common.processing")}</Text>
                </View>
            ) : (
                <>
                    <Text style={styles.countLabel}>
                        {t("bulkToolbar.selectedCount", { count: selectedCount })}
                    </Text>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={onToggleFavorite}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.favoriteText}>{t("bulkToolbar.favorite")}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={onDelete}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.deleteText}>{t("bulkToolbar.delete")}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={onCancel}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.cancelText}>{t("bulkToolbar.cancel")}</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </GlassSurface>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        borderTopWidth: 1,
        borderTopColor: Colors.borderLight,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    countLabel: {
        fontSize: 14,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: Colors.frostGray,
    },
    favoriteText: {
        fontSize: 13,
        fontWeight: "600",
        color: Colors.morningGold,
    },
    deleteText: {
        fontSize: 13,
        fontWeight: "600",
        color: Colors.error,
    },
    cancelText: {
        fontSize: 13,
        fontWeight: "600",
        color: Colors.textSecondary,
    },
    processingRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    processingText: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
});
