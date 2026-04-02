import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { Colors } from "@/constants/colors";
import type { BulkImportGpsGroup } from "@/types";

interface GpsConfirmationDialogProps {
    groups: BulkImportGpsGroup[];
    noGpsCount: number;
    onToggleGroup: (resortName: string) => void;
    onConfirm: () => void;
    onSkip: () => void;
    isApplying: boolean;
}

/**
 * 一括インポート後の GPS スキー場確認画面
 */
export function GpsConfirmationDialog({
    groups,
    noGpsCount,
    onToggleGroup,
    onConfirm,
    onSkip,
    isApplying,
}: GpsConfirmationDialogProps) {
    const hasConfirmed = groups.some((g) => g.confirmed);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>撮影地のスキー場を設定</Text>
            <Text style={styles.subtitle}>
                GPS情報から検出されたスキー場です
            </Text>

            {/* スキー場グループリスト */}
            <View style={styles.groupList}>
                {groups.map((group) => (
                    <TouchableOpacity
                        key={group.resortName}
                        style={styles.groupRow}
                        onPress={() => onToggleGroup(group.resortName)}
                        disabled={isApplying}
                    >
                        <View style={[
                            styles.checkbox,
                            group.confirmed && styles.checkboxChecked,
                        ]}>
                            {group.confirmed && (
                                <Text style={styles.checkmark}>✓</Text>
                            )}
                        </View>
                        <View style={styles.groupInfo}>
                            <Text style={styles.resortName}>{group.resortName}</Text>
                            <Text style={styles.groupMeta}>
                                {group.videoIds.length}本 · {group.distanceKm.toFixed(1)} km
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            {/* GPS なし動画のカウント */}
            {noGpsCount > 0 && (
                <Text style={styles.noGpsText}>
                    GPS情報なし: {noGpsCount}本（後で個別に設定できます）
                </Text>
            )}

            {/* ボタン */}
            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={onSkip}
                    disabled={isApplying}
                >
                    <Text style={styles.skipButtonText}>スキップ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.confirmButton,
                        (!hasConfirmed || isApplying) && styles.confirmButtonDisabled,
                    ]}
                    onPress={onConfirm}
                    disabled={!hasConfirmed || isApplying}
                >
                    {isApplying ? (
                        <ActivityIndicator color={Colors.headerText} size="small" />
                    ) : (
                        <Text style={styles.confirmButtonText}>適用する</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: "800",
        color: Colors.textPrimary,
        textAlign: "center",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: "center",
        marginBottom: 24,
    },
    groupList: {
        gap: 8,
        marginBottom: 16,
    },
    groupRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.freshSnow,
        borderRadius: 12,
        padding: 14,
        gap: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
    checkboxChecked: {
        backgroundColor: Colors.alpineBlue,
        borderColor: Colors.alpineBlue,
    },
    checkmark: {
        color: Colors.headerText,
        fontSize: 14,
        fontWeight: "700",
    },
    groupInfo: {
        flex: 1,
    },
    resortName: {
        fontSize: 15,
        fontWeight: "600",
        color: Colors.textPrimary,
    },
    groupMeta: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    noGpsText: {
        fontSize: 13,
        color: Colors.textTertiary,
        textAlign: "center",
        marginBottom: 24,
    },
    buttonRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
    },
    skipButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: "center",
    },
    skipButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: Colors.textSecondary,
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: Colors.alpineBlue,
        alignItems: "center",
    },
    confirmButtonDisabled: {
        backgroundColor: Colors.textTertiary,
    },
    confirmButtonText: {
        fontSize: 15,
        fontWeight: "700",
        color: Colors.headerText,
    },
});
