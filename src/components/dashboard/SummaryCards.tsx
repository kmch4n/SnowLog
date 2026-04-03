import { StyleSheet, Text, View } from "react-native";

import { Colors } from "../../constants/colors";
import { formatDurationHM } from "../../utils/dateUtils";
import type { DashboardSummary } from "../../types/dashboard";

interface SummaryCardsProps {
    summary: DashboardSummary;
}

interface CardData {
    icon: string;
    value: string;
    label: string;
    color: string;
}

/** 2x2 サマリーカードグリッド */
export function SummaryCards({ summary }: SummaryCardsProps) {
    const cards: CardData[] = [
        {
            icon: "🎿",
            value: `${summary.totalSkiDays}`,
            label: "滑走日数",
            color: Colors.alpineBlue,
        },
        {
            icon: "🎬",
            value: `${summary.totalVideoCount}`,
            label: "動画数",
            color: Colors.textPrimary,
        },
        {
            icon: "⏱",
            value: formatDurationHM(summary.totalDurationSeconds),
            label: "総撮影時間",
            color: Colors.morningGold,
        },
        {
            icon: "⛷",
            value: `${summary.uniqueResortCount}`,
            label: "訪問スキー場",
            color: Colors.alpineBlue,
        },
    ];

    const rows = [
        cards.slice(0, 2),
        cards.slice(2, 4),
    ];

    return (
        <View style={styles.panel}>
            {rows.map((row, rowIndex) => (
                <View
                    key={`row-${rowIndex}`}
                    style={[
                        styles.row,
                        rowIndex === 0 && styles.rowDivider,
                    ]}
                >
                    {row.map((card, cellIndex) => (
                        <View
                            key={card.label}
                            style={[
                                styles.cell,
                                cellIndex === 0 && styles.cellDivider,
                            ]}
                        >
                            <Text style={styles.icon}>{card.icon}</Text>
                            <Text style={[styles.value, { color: card.color }]}>
                                {card.value}
                            </Text>
                            <Text style={styles.label}>{card.label}</Text>
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: Colors.freshSnow,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.frostGray,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
    },
    rowDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.frostGray,
    },
    cell: {
        width: "50%",
        paddingVertical: 14,
        paddingHorizontal: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    cellDivider: {
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: Colors.frostGray,
    },
    icon: {
        fontSize: 18,
        marginBottom: 4,
    },
    value: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 2,
    },
    label: {
        fontSize: 11,
        color: Colors.textSecondary,
        fontWeight: "500",
    },
});
