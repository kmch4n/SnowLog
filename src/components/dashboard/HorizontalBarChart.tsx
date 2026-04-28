import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "../../constants/colors";
import { useTranslation } from "../../i18n/useTranslation";

interface BarItem {
    label: string;
    value: number;
    subLabel?: string;
}

interface HorizontalBarChartProps {
    data: BarItem[];
    maxItems?: number;
    barColor?: string;
    barHeight?: number;
    onItemPress?: (item: BarItem) => void;
}

/** 横棒グラフ: スキー場ランキング・テクニック分布に使用 */
export function HorizontalBarChart({
    data,
    maxItems = 5,
    barColor = Colors.alpineBlue,
    barHeight = 20,
    onItemPress,
}: HorizontalBarChartProps) {
    const { t } = useTranslation();
    const items = data.slice(0, maxItems);
    const maxValue = Math.max(...items.map((d) => d.value), 1);

    if (items.length === 0) {
        return (
            <Text style={styles.emptyText}>{t("dashboard.empty")}</Text>
        );
    }

    return (
        <View>
            {items.map((item) => {
                const ratio = item.value / maxValue;
                return (
                    <TouchableOpacity
                        key={item.label}
                        style={styles.row}
                        disabled={onItemPress == null}
                        activeOpacity={0.7}
                        onPress={() => onItemPress?.(item)}
                    >
                        <View style={styles.labelWrap}>
                            <Text style={styles.label} numberOfLines={2}>
                                {item.label}
                            </Text>
                        </View>
                        <View style={[styles.barContainer, { height: barHeight }]}>
                            <View style={[styles.barTrack, { height: barHeight }]}>
                                {item.value > 0 && (
                                    <View
                                        style={[
                                            styles.barFill,
                                            {
                                                width: `${Math.min(
                                                    Math.max(ratio, 0.05),
                                                    1
                                                ) * 100}%`,
                                                backgroundColor: barColor,
                                                opacity: 0.3 + 0.7 * ratio,
                                            },
                                        ]}
                                    />
                                )}
                            </View>
                        </View>
                        <Text style={styles.value}>{item.value}</Text>
                        {item.subLabel && (
                            <Text style={styles.subLabel}>{item.subLabel}</Text>
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
        gap: 8,
    },
    labelWrap: {
        width: 120,
        paddingRight: 4,
    },
    label: {
        fontSize: 12,
        lineHeight: 16,
        color: Colors.textPrimary,
        fontWeight: "500",
    },
    barContainer: {
        flex: 1,
        justifyContent: "center",
    },
    barTrack: {
        width: "100%",
        borderRadius: 4,
        backgroundColor: Colors.frostGray,
        overflow: "hidden",
    },
    barFill: {
        height: "100%",
        borderRadius: 4,
    },
    value: {
        fontSize: 13,
        fontWeight: "700",
        color: Colors.textPrimary,
        minWidth: 24,
        textAlign: "right",
    },
    subLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
        minWidth: 32,
    },
    emptyText: {
        fontSize: 13,
        color: Colors.textTertiary,
        textAlign: "center",
        paddingVertical: 12,
    },
});
