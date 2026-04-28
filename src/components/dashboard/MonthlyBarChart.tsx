import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "../../constants/colors";
import { useTranslation } from "../../i18n/useTranslation";
import type { MonthlyTrend } from "../../types/dashboard";

interface MonthlyBarChartProps {
    data: MonthlyTrend[];
    onBarPress?: (item: MonthlyTrend) => void;
}

type Metric = "videoCount" | "skiDays";

const CHART_HEIGHT = 120;
const BAR_BOTTOM_MARGIN = 20; // X軸ラベル分のスペース

function formatMonthLabel(yearMonth: string, locale: "ja" | "en"): string {
    const month = Number(yearMonth.split("-")[1]);
    if (!Number.isFinite(month)) return yearMonth;
    if (locale === "ja") return `${month}月`;
    return new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "short" });
}

/** 月別縦棒グラフ（11月〜5月） */
export function MonthlyBarChart({ data, onBarPress }: MonthlyBarChartProps) {
    const { t, locale } = useTranslation();
    const [metric, setMetric] = useState<Metric>("videoCount");

    const maxValue = Math.max(...data.map((d) => d[metric]), 1);
    const barMaxHeight = CHART_HEIGHT - BAR_BOTTOM_MARGIN - 16;

    if (data.length === 0) {
        return (
            <Text style={styles.emptyText}>{t("dashboard.empty")}</Text>
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
                        {t("dashboard.videosLabel")}
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
                        {t("dashboard.summary.skiDays")}
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
                        <TouchableOpacity
                            key={item.yearMonth}
                            style={styles.barWrapper}
                            disabled={onBarPress == null}
                            activeOpacity={0.7}
                            onPress={() => onBarPress?.(item)}
                        >
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
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* X軸ラベル + 値ラベル（RN Text で描画） */}
            <View style={styles.labelsRow}>
                {data.map((item) => (
                    <TouchableOpacity
                        key={item.yearMonth}
                        style={styles.labelCell}
                        disabled={onBarPress == null}
                        activeOpacity={0.7}
                        onPress={() => onBarPress?.(item)}
                    >
                        <Text style={styles.valueLabel}>
                            {item[metric] > 0 ? item[metric] : ""}
                        </Text>
                        <Text style={styles.monthLabel}>
                            {formatMonthLabel(item.yearMonth, locale)}
                        </Text>
                    </TouchableOpacity>
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
