import { useRouter } from "expo-router";
import { useCallback } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { CalendarGrid } from "@/components/CalendarGrid";
import { Colors } from "@/constants/colors";
import { VideoCardCompact } from "@/components/VideoCardCompact";
import { useCalendar } from "@/hooks/useCalendar";

const MONTH_NAMES = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
];

/**
 * カレンダー画面
 * 月次カレンダーで動画の撮影日を確認し、日付タップで当日の動画一覧を表示する
 */
export default function CalendarScreen() {
    const router = useRouter();
    const {
        year,
        month,
        selectedDay,
        setSelectedDay,
        prevMonth,
        nextMonth,
        datesWithVideos,
        selectedDateVideos,
    } = useCalendar();

    const handleVideoPress = useCallback(
        (id: string) => {
            router.push(`/video/${id}`);
        },
        [router]
    );

    return (
        <View style={styles.container}>
            {/* 月ナビゲーション */}
            <View style={styles.navRow}>
                <TouchableOpacity style={styles.navButton} onPress={prevMonth}>
                    <Text style={styles.navArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                    {year}年 {MONTH_NAMES[month - 1]}
                </Text>
                <TouchableOpacity style={styles.navButton} onPress={nextMonth}>
                    <Text style={styles.navArrow}>›</Text>
                </TouchableOpacity>
            </View>

            {/* カレンダーグリッド */}
            <View style={styles.calendarContainer}>
                <CalendarGrid
                    year={year}
                    month={month}
                    selectedDay={selectedDay}
                    datesWithVideos={datesWithVideos}
                    onSelectDay={setSelectedDay}
                />
            </View>

            {/* 選択日の動画一覧 */}
            {selectedDay !== null && (
                <View style={styles.panelContainer}>
                    <View style={styles.panelHeader}>
                        <Text style={styles.panelTitle}>
                            {month}月{selectedDay}日の動画
                        </Text>
                        <Text style={styles.panelCount}>
                            {selectedDateVideos.length}件
                        </Text>
                    </View>

                    {selectedDateVideos.length === 0 ? (
                        <View style={styles.panelEmpty}>
                            <Text style={styles.panelEmptyText}>
                                この日の動画はありません
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={selectedDateVideos}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <VideoCardCompact
                                    video={item}
                                    onPress={() => handleVideoPress(item.id)}
                                />
                            )}
                            ItemSeparatorComponent={() => (
                                <View style={styles.separator} />
                            )}
                        />
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.freshSnow,
    },
    navRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
    },
    navButton: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
    },
    navArrow: {
        fontSize: 28,
        color: Colors.alpineBlue,
        lineHeight: 32,
    },
    monthTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    calendarContainer: {
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
    },
    panelContainer: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
    },
    panelHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 8,
    },
    panelTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    panelCount: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    panelEmpty: {
        alignItems: "center",
        paddingTop: 32,
    },
    panelEmptyText: {
        fontSize: 14,
        color: Colors.textTertiary,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.border,
        marginLeft: 16 + 72 + 12,
    },
});
