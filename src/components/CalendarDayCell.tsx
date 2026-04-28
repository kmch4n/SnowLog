import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import {
    THUMBNAIL_MISSING_SENTINEL,
    resolveThumbnailUri,
} from "@/services/thumbnailService";
import { useTranslation } from "@/i18n/useTranslation";
import type { CalendarViewMode, DayInfo } from "@/types";

interface CalendarDayCellProps {
    day: number | null;
    dateKey: string;
    isToday: boolean;
    isSelected: boolean;
    dayInfo: DayInfo | undefined;
    viewMode: CalendarViewMode;
    onPress: (day: number) => void;
    isWeekend: boolean;
    isSunday: boolean;
    /** 週表示で曜日ラベルを表示するために使用 */
    dayLabel?: string;
}

/**
 * カレンダーの日付セル（月表示・週表示の両方で使用）
 * 月表示: 日番号 + 動画数バッジ + スキー場カラードット
 * 週表示: 曜日ラベル + 日番号 + サムネイル + 本数 + スキー場名
 */
export function CalendarDayCell({
    day,
    dateKey,
    isToday,
    isSelected,
    dayInfo,
    viewMode,
    onPress,
    isWeekend,
    isSunday,
    dayLabel,
}: CalendarDayCellProps) {
    const { t } = useTranslation();

    if (day === null) {
        return <View style={viewMode === "month" ? styles.monthCell : styles.weekCell} />;
    }

    const dayTextColor = isSunday
        ? Colors.sundayText
        : isWeekend
            ? Colors.saturdayText
            : Colors.textPrimary;

    if (viewMode === "week") {
        return (
            <TouchableOpacity
                style={[styles.weekCell, isSelected && styles.weekCellSelected]}
                onPress={() => onPress(day)}
                activeOpacity={0.7}
            >
                {/* 曜日 + 日番号 */}
                <View style={styles.weekHeader}>
                    {dayLabel && (
                        <Text style={[styles.weekDayLabel, { color: dayTextColor }]}>
                            {dayLabel}
                        </Text>
                    )}
                    <View
                        style={[
                            styles.weekDayCircle,
                            isSelected && styles.dayCircleSelected,
                            isToday && !isSelected && styles.dayCircleToday,
                        ]}
                    >
                        <Text
                            style={[
                                styles.weekDayNumber,
                                isSelected && styles.dayTextSelected,
                                !isSelected && { color: dayTextColor },
                            ]}
                        >
                            {day}
                        </Text>
                    </View>
                </View>

                {/* サムネイル */}
                {dayInfo?.thumbnailUri && dayInfo.thumbnailUri !== THUMBNAIL_MISSING_SENTINEL ? (
                    <Image
                        source={{ uri: resolveThumbnailUri(dayInfo.thumbnailUri) }}
                        style={styles.weekThumb}
                    />
                ) : (
                    <View style={[styles.weekThumb, styles.weekThumbEmpty]} />
                )}

                {/* 本数 + スキー場ドット */}
                {dayInfo && dayInfo.videoCount > 0 && (
                    <View style={styles.weekMeta}>
                        <Text style={styles.weekVideoCount}>
                            {t("calendar.videoCountShort", { count: dayInfo.videoCount })}
                        </Text>
                        <View style={styles.dotRow}>
                            {dayInfo.resortNames.slice(0, 3).map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.resortDot,
                                        { backgroundColor: Colors.resortDots[i % Colors.resortDots.length] },
                                    ]}
                                />
                            ))}
                        </View>
                    </View>
                )}

                {/* スキー場名 */}
                {dayInfo?.resortNames[0] && (
                    <Text style={styles.weekResortName} numberOfLines={1}>
                        {dayInfo.resortNames[0]}
                    </Text>
                )}

                {/* 日記インジケーター */}
                {dayInfo?.hasDiary && (
                    <Text style={styles.weekDiaryBadge}>📝</Text>
                )}
            </TouchableOpacity>
        );
    }

    // --- 月表示 ---
    return (
        <TouchableOpacity
            style={styles.monthCell}
            onPress={() => onPress(day)}
            activeOpacity={0.7}
        >
            {/* 日番号 */}
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
                        !isSelected && { color: dayTextColor },
                    ]}
                >
                    {day}
                </Text>
            </View>

            {/* 動画数バッジ */}
            {dayInfo && dayInfo.videoCount > 0 && (
                <View style={[
                    styles.countBadge,
                    isSelected && styles.countBadgeSelected,
                ]}>
                    <Text style={[
                        styles.countText,
                        isSelected && styles.countTextSelected,
                    ]}>
                        {dayInfo.videoCount}
                    </Text>
                </View>
            )}

            {/* スキー場カラードット + 日記インジケーター */}
            {dayInfo && (dayInfo.resortNames.length > 0 || dayInfo.hasDiary) && (
                <View style={styles.dotRow}>
                    {dayInfo.resortNames.slice(0, 3).map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.resortDot,
                                isSelected && { backgroundColor: Colors.headerText },
                                !isSelected && {
                                    backgroundColor: Colors.resortDots[i % Colors.resortDots.length],
                                },
                            ]}
                        />
                    ))}
                    {dayInfo.hasDiary && (
                        <View
                            style={[
                                styles.resortDot,
                                {
                                    backgroundColor: isSelected
                                        ? Colors.headerText
                                        : Colors.morningGold,
                                },
                            ]}
                        />
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    // --- 月表示セル ---
    monthCell: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 3,
        minHeight: 56,
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
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
    countBadge: {
        backgroundColor: Colors.alpineBlueLight,
        borderRadius: 6,
        paddingHorizontal: 4,
        paddingVertical: 1,
        marginTop: 1,
    },
    countBadgeSelected: {
        backgroundColor: "rgba(255,255,255,0.3)",
    },
    countText: {
        fontSize: 10,
        fontWeight: "700",
        color: Colors.alpineBlue,
    },
    countTextSelected: {
        color: Colors.headerText,
    },
    dotRow: {
        flexDirection: "row",
        gap: 3,
        marginTop: 2,
    },
    resortDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },

    // --- 週表示セル ---
    weekCell: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 2,
        borderRadius: 10,
    },
    weekCellSelected: {
        backgroundColor: Colors.alpineBlueLight,
    },
    weekHeader: {
        alignItems: "center",
        marginBottom: 6,
    },
    weekDayLabel: {
        fontSize: 11,
        fontWeight: "600",
        marginBottom: 2,
    },
    weekDayCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    weekDayNumber: {
        fontSize: 13,
        fontWeight: "600",
    },
    weekThumb: {
        width: 40,
        height: 30,
        borderRadius: 4,
        marginBottom: 4,
    },
    weekThumbEmpty: {
        backgroundColor: Colors.frostGray,
    },
    weekMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    weekVideoCount: {
        fontSize: 10,
        fontWeight: "700",
        color: Colors.textSecondary,
    },
    weekResortName: {
        fontSize: 9,
        color: Colors.textTertiary,
        marginTop: 2,
        maxWidth: "100%",
    },
    weekDiaryBadge: {
        fontSize: 10,
        marginTop: 2,
    },
});
