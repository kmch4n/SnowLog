import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { Colors } from "../../constants/colors";
import type { HeatmapDay, Season } from "../../types/dashboard";

interface ActivityHeatmapProps {
    days: HeatmapDay[];
    season: Season;
}

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
const LABEL_WIDTH = 20;
const CELL_GAP = 2;

/** 色の強度を算出（0=空、1-2=薄い、3+=濃い） */
function getColor(count: number): string {
    if (count === 0) return Colors.frostGray;
    if (count === 1) return "#B8D4F0";
    if (count === 2) return "#6AAAE0";
    return Colors.alpineBlue;
}

/** GitHub風アクティビティヒートマップ */
export function ActivityHeatmap({ days, season }: ActivityHeatmapProps) {
    const { width: screenWidth } = useWindowDimensions();
    const availableWidth = screenWidth - 32 - 32 - LABEL_WIDTH; // padding + card padding + labels

    // シーズン開始日（11月1日）から終了日（5月31日）までの全日付を生成
    const startDate = new Date(season.dateFrom * 1000);
    // 週の開始を月曜日に揃える
    const startDay = startDate.getDay(); // 0=日, 1=月, ...
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    const gridStart = new Date(startDate);
    gridStart.setDate(gridStart.getDate() + mondayOffset);

    const endDate = new Date(season.dateTo * 1000);

    // 週数を計算
    const totalDays = Math.ceil(
        (endDate.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalWeeks = Math.ceil(totalDays / 7);

    // セルサイズ計算
    const cellSize = Math.max(
        Math.floor((availableWidth - (totalWeeks - 1) * CELL_GAP) / totalWeeks),
        6
    );
    const svgWidth = totalWeeks * (cellSize + CELL_GAP);
    const svgHeight = 7 * (cellSize + CELL_GAP);

    // 日付→カウント のルックアップ
    const dayMap = new Map(days.map((d) => [d.dateKey, d.count]));

    // 月境界ラベル
    const monthLabels: { x: number; label: string }[] = [];
    let lastMonth = -1;

    // セルデータを生成
    const cells: { x: number; y: number; count: number }[] = [];
    const cursor = new Date(gridStart);
    for (let week = 0; week < totalWeeks; week++) {
        for (let dow = 0; dow < 7; dow++) {
            if (cursor > endDate && cursor > startDate) {
                // シーズン範囲外はスキップ
            } else if (cursor >= startDate && cursor <= endDate) {
                const dk = formatDateKey(cursor);
                cells.push({
                    x: week * (cellSize + CELL_GAP),
                    y: dow * (cellSize + CELL_GAP),
                    count: dayMap.get(dk) ?? 0,
                });

                // 月境界ラベル
                const month = cursor.getMonth();
                if (month !== lastMonth && dow === 0) {
                    lastMonth = month;
                    monthLabels.push({
                        x: week * (cellSize + CELL_GAP),
                        label: `${cursor.getMonth() + 1}月`,
                    });
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }
    }

    return (
        <View>
            {/* 月ラベル */}
            <View style={[styles.monthRow, { paddingLeft: LABEL_WIDTH }]}>
                {monthLabels.map((ml) => (
                    <Text
                        key={`${ml.label}-${ml.x}`}
                        style={[styles.monthLabel, { position: "absolute", left: LABEL_WIDTH + ml.x }]}
                    >
                        {ml.label}
                    </Text>
                ))}
            </View>

            <View style={styles.gridRow}>
                {/* 曜日ラベル */}
                <View style={styles.dayLabels}>
                    {DAY_LABELS.map((label, i) => (
                        <View
                            key={label}
                            style={[styles.dayLabelCell, { height: cellSize + CELL_GAP }]}
                        >
                            {i % 2 === 0 && (
                                <Text style={styles.dayLabelText}>{label}</Text>
                            )}
                        </View>
                    ))}
                </View>

                {/* ヒートマップ */}
                <View
                    style={[
                        styles.heatmapCanvas,
                        { width: svgWidth, height: svgHeight },
                    ]}
                >
                    {cells.map((cell) => (
                        <View
                            key={`${cell.x}-${cell.y}`}
                            style={[
                                styles.cell,
                                {
                                    left: cell.x,
                                    top: cell.y,
                                    width: cellSize,
                                    height: cellSize,
                                    backgroundColor: getColor(cell.count),
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>

            {/* 凡例 */}
            <View style={styles.legendRow}>
                <Text style={styles.legendText}>少</Text>
                {[0, 1, 2, 3].map((level) => (
                    <View
                        key={level}
                        style={[
                            styles.legendCell,
                            { backgroundColor: getColor(level) },
                        ]}
                    />
                ))}
                <Text style={styles.legendText}>多</Text>
            </View>
        </View>
    );
}

/** Date を "YYYY-MM-DD" に変換 */
function formatDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

const styles = StyleSheet.create({
    monthRow: {
        height: 16,
        position: "relative",
        marginBottom: 2,
    },
    monthLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
    },
    gridRow: {
        flexDirection: "row",
    },
    heatmapCanvas: {
        position: "relative",
    },
    cell: {
        position: "absolute",
        borderRadius: 2,
    },
    dayLabels: {
        width: LABEL_WIDTH,
    },
    dayLabelCell: {
        justifyContent: "center",
    },
    dayLabelText: {
        fontSize: 9,
        color: Colors.textTertiary,
    },
    legendRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 3,
        marginTop: 8,
    },
    legendText: {
        fontSize: 10,
        color: Colors.textTertiary,
    },
    legendCell: {
        width: 10,
        height: 10,
        borderRadius: 2,
    },
});
