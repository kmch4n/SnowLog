import { StyleSheet, Text, View } from "react-native";

import { CalendarDayCell } from "./CalendarDayCell";
import { Colors } from "@/constants/colors";
import {
    getDayLabels,
    getMonthOffset,
    isSaturdayColumn,
    isSundayColumn,
} from "@/utils/calendarUtils";
import { toDateKey } from "@/utils/dateUtils";
import { useTranslation } from "@/i18n/useTranslation";
import type { DayInfo, WeekStartDay } from "@/types";

interface CalendarMonthGridProps {
    year: number;
    /** 1-based */
    month: number;
    selectedDay: number | null;
    dayInfoMap: Map<string, DayInfo>;
    weekStartDay: WeekStartDay;
    onSelectDay: (day: number) => void;
}

/**
 * 月次カレンダーグリッド（拡張版）
 * - weekStartDay に応じた曜日並び替え
 * - リッチな日付セル（CalendarDayCell 使用）
 * - 土日の色分け
 */
export function CalendarMonthGrid({
    year,
    month,
    selectedDay,
    dayInfoMap,
    weekStartDay,
    onSelectDay,
}: CalendarMonthGridProps) {
    const { locale } = useTranslation();
    const today = new Date();
    const todayKey = toDateKey(Math.floor(today.getTime() / 1000));
    const dayLabels = getDayLabels(weekStartDay, locale);

    // 月の日数
    const daysInMonth = new Date(year, month, 0).getDate();

    // 月初のオフセット
    const offset = getMonthOffset(year, month, weekStartDay);

    // グリッドセルを生成
    const cells: (number | null)[] = [
        ...Array(offset).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) {
        cells.push(null);
    }

    // 7列の行に分割
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
        rows.push(cells.slice(i, i + 7));
    }

    return (
        <View style={styles.container}>
            {/* 曜日ヘッダー */}
            <View style={styles.row}>
                {dayLabels.map((label, i) => (
                    <View key={`${label}-${i}`} style={styles.headerCell}>
                        <Text
                            style={[
                                styles.dayLabel,
                                isSundayColumn(i, weekStartDay) && styles.sundayLabel,
                                isSaturdayColumn(i, weekStartDay) && styles.saturdayLabel,
                            ]}
                        >
                            {label}
                        </Text>
                    </View>
                ))}
            </View>

            {/* 日付グリッド */}
            {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                    {row.map((day, colIndex) => {
                        const dateKey = day !== null
                            ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                            : "";

                        return (
                            <CalendarDayCell
                                key={colIndex}
                                day={day}
                                dateKey={dateKey}
                                isToday={dateKey === todayKey}
                                isSelected={day === selectedDay}
                                dayInfo={day !== null ? dayInfoMap.get(dateKey) : undefined}
                                viewMode="month"
                                onPress={onSelectDay}
                                isWeekend={isSaturdayColumn(colIndex, weekStartDay) || isSundayColumn(colIndex, weekStartDay)}
                                isSunday={isSundayColumn(colIndex, weekStartDay)}
                            />
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 8,
    },
    row: {
        flexDirection: "row",
    },
    headerCell: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 6,
    },
    dayLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: "600",
    },
    saturdayLabel: {
        color: Colors.saturdayText,
    },
    sundayLabel: {
        color: Colors.sundayText,
    },
});
