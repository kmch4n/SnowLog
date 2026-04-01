import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "../constants/colors";
import { toDateKey } from "../utils/dateUtils";

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

interface CalendarGridProps {
    year: number;
    /** 1-based */
    month: number;
    selectedDay: number | null;
    datesWithVideos: Set<string>;
    onSelectDay: (day: number) => void;
}

/**
 * 月次カレンダーグリッド
 * - 月曜始まり
 * - 動画がある日付に青ドット
 * - 選択日は青背景
 * - 今日は枠線で強調
 */
export function CalendarGrid({
    year,
    month,
    selectedDay,
    datesWithVideos,
    onSelectDay,
}: CalendarGridProps) {
    const today = new Date();
    const todayKey = toDateKey(Math.floor(today.getTime() / 1000));

    // 月の日数
    const daysInMonth = new Date(year, month, 0).getDate();

    // 月初の曜日（0=日, 1=月 ... 6=土）→ 月曜始まりに変換（0=月, ..., 6=日）
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    // グリッドセルを生成（null = 空白セル）
    const cells: (number | null)[] = [
        ...Array(offset).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // 7の倍数になるよう末尾を埋める
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
                {DAY_LABELS.map((label) => (
                    <View key={label} style={styles.cell}>
                        <Text style={styles.dayLabel}>{label}</Text>
                    </View>
                ))}
            </View>

            {/* 日付グリッド */}
            {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                    {row.map((day, colIndex) => {
                        if (day === null) {
                            return <View key={colIndex} style={styles.cell} />;
                        }

                        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const isToday = dateKey === todayKey;
                        const isSelected = day === selectedDay;
                        const hasVideos = datesWithVideos.has(dateKey);

                        return (
                            <TouchableOpacity
                                key={colIndex}
                                style={styles.cell}
                                onPress={() => onSelectDay(day)}
                                activeOpacity={0.7}
                            >
                                <View
                                    style={[
                                        styles.dayCircle,
                                        isSelected && styles.dayCircleSelected,
                                        isToday && !isSelected && styles.dayCircleToday,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.dayText,
                                            isSelected && styles.dayTextSelected,
                                        ]}
                                    >
                                        {day}
                                    </Text>
                                </View>
                                {hasVideos && (
                                    <View
                                        style={[
                                            styles.dot,
                                            isSelected && styles.dotSelected,
                                        ]}
                                    />
                                )}
                            </TouchableOpacity>
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
    cell: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 4,
    },
    dayLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: "600",
        paddingVertical: 6,
    },
    dayCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: "center",
        alignItems: "center",
    },
    dayCircleSelected: {
        backgroundColor: Colors.alpineBlue,
    },
    dayCircleToday: {
        borderWidth: 1.5,
        borderColor: Colors.alpineBlue,
    },
    dayText: {
        fontSize: 14,
        color: Colors.textPrimary,
    },
    dayTextSelected: {
        color: Colors.headerText,
        fontWeight: "700",
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: Colors.alpineBlue,
        marginTop: 2,
    },
    dotSelected: {
        backgroundColor: Colors.headerText,
    },
});
