import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "../../constants/colors";
import type { MonthlyTrend } from "../../types/dashboard";

interface MonthlyBarChartProps {
    data: MonthlyTrend[];
}

type Metric = "videoCount" | "skiDays";

const CHART_HEIGHT = 120;
const BAR_BOTTOM_MARGIN = 20; // X軸ラベル分のスペース

/** 月別縦棒グラフ（11月〜5月） */
export function MonthlyBarChart({ data }: MonthlyBarChartProps) {
    const [metric, setMetric] = useState<Metric>("videoCount");

    const maxValue = Math.max(...data.map((d) => d[metric]), 1);
    const barMaxHeight = CHART_HEIGHT - BAR_BOTTOM_MARGIN - 16;

    if (data.length === 0) {
        return (
            <Text style={styles.emptyText}>データなし</Text>
        );
    }

    return (
        <View>
            {/* メトリック切替 */}
            <View style={styles.toggleRow}>
                <TouchableOpacity
                    style={[styles.toggleBtn, metric === "videoCount" && styles.toggleBtnActive]}
                    onPress={() => setMetric("videoCount")}
                >
                    <Text
                        style={[
                            styles.toggleText,
                            metric === "videoCount" && styles.toggleTextActive,
                        ]}
                    >
                        動画数
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, metric === "skiDays" && styles.toggleBtnActive]}
                    onPress={() => setMetric("skiDays")}
                >
                    <Text
                        style={[
                            styles.toggleText,
                            metric === "skiDays" && styles.toggleTextActive,
                        ]}
                    >
                        滑走日数
                    </Text>
                </TouchableOpacity>
            </View>

            {/* チャート */}
            <View style={[styles.chartArea, { height: CHART_HEIGHT }]}>
                {data.map((item) => {
                    const value = item[metric];
                    const ratio = maxValue > 0 ? value / maxValue : 0;
                    const barHeight = Math.max(ratio * barMaxHeight, value > 0 ? 4 : 0);

                    return (
                        <View key={item.yearMonth} style={styles.barWrapper}>
                            <View
                                style={[
                                    styles.bar,
                                    {
                                        height: barHeight,
                                        backgroundColor:
                                            metric === "videoCount"
                                                ? Colors.alpineBlue
                                                : Colors.morningGold,
                                        opacity: 0.4 + 0.6 * ratio,
                                    },
                                ]}
                            />
                        </View>
                    );
                })}
            </View>

            {/* X軸ラベル + 値ラベル（RN Text で描画） */}
            <View style={styles.labelsRow}>
                {data.map((item) => (
                    <View key={item.yearMonth} style={styles.labelCell}>
                        <Text style={styles.valueLabel}>
                            {item[metric] > 0 ? item[metric] : ""}
                        </Text>
                        <Text style={styles.monthLabel}>{item.label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    toggleRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 12,
    },
    toggleBtn: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: Colors.frostGray,
    },
    toggleBtnActive: {
        backgroundColor: Colors.alpineBlue,
    },
    toggleText: {
        fontSize: 12,
        fontWeight: "600",
        color: Colors.textSecondary,
    },
    toggleTextActive: {
        color: Colors.headerText,
    },
    chartArea: {
        flexDirection: "row",
        alignItems: "flex-end",
        marginBottom: BAR_BOTTOM_MARGIN - 4,
    },
    barWrapper: {
        width: 40,
        alignItems: "center",
        justifyContent: "flex-end",
    },
    bar: {
        width: 24,
        borderRadius: 4,
    },
    labelsRow: {
        flexDirection: "row",
        marginTop: -16,
    },
    labelCell: {
        width: 40,
        alignItems: "center",
    },
    valueLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    monthLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
    },
    emptyText: {
        fontSize: 13,
        color: Colors.textTertiary,
        textAlign: "center",
        paddingVertical: 12,
    },
});
