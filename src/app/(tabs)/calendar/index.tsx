import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { CalendarMonthGrid } from "@/components/CalendarMonthGrid";
import { CalendarWeekStrip } from "@/components/CalendarWeekStrip";
import { DiaryCard } from "@/components/DiaryCard";
import { DiaryEditModal } from "@/components/DiaryEditModal";
import { Colors } from "@/constants/colors";
import { VideoCardCompact } from "@/components/VideoCardCompact";
import { useCalendarEnhanced } from "@/hooks/useCalendarEnhanced";
import { useDiaryEntry } from "@/hooks/useDiaryEntry";

const MONTH_NAMES = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
];

/**
 * カレンダー画面
 * 月次/週次カレンダーで動画の撮影日を確認し、日付タップで当日の動画一覧を表示する
 */
export default function CalendarScreen() {
    const router = useRouter();
    const {
        year,
        month,
        selectedDay,
        setSelectedDay,
        viewMode,
        toggleViewMode,
        weekStartDay,
        dayInfoMap,
        prevMonth,
        nextMonth,
        weekDates,
        weekTitle,
        prevWeek,
        nextWeek,
        selectedDateVideos,
        selectedDateKey,
        refreshDiaryKeys,
    } = useCalendarEnhanced();

    const { diary, save: saveDiary, remove: removeDiary, refresh: refreshDiary } = useDiaryEntry(selectedDateKey);
    const [diaryModalVisible, setDiaryModalVisible] = useState(false);

    const handleVideoPress = useCallback(
        (id: string) => {
            router.push(`/video/${id}`);
        },
        [router]
    );

    const handleDiaryClose = useCallback(() => {
        setDiaryModalVisible(false);
        refreshDiary();
        refreshDiaryKeys();
    }, [refreshDiary, refreshDiaryKeys]);

    const isMonthView = viewMode === "month";

    // 選択日のパネルタイトル
    const panelTitle = selectedDay !== null
        ? isMonthView
            ? `${month}月${selectedDay}日`
            : (() => {
                const d = weekDates.find((wd) => wd.getDate() === selectedDay);
                return d ? `${d.getMonth() + 1}月${d.getDate()}日` : "";
            })()
        : "";

    return (
        <View style={styles.container}>
            {/* ナビゲーションバー */}
            <View style={styles.navRow}>
                <TouchableOpacity
                    style={styles.navButton}
                    onPress={isMonthView ? prevMonth : prevWeek}
                >
                    <Text style={styles.navArrow}>‹</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={toggleViewMode} activeOpacity={0.7}>
                    <Text style={styles.monthTitle}>
                        {isMonthView
                            ? `${year}年 ${MONTH_NAMES[month - 1]}`
                            : weekTitle}
                    </Text>
                    <Text style={styles.viewModeHint}>
                        {isMonthView ? "タップで週表示" : "タップで月表示"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navButton}
                    onPress={isMonthView ? nextMonth : nextWeek}
                >
                    <Text style={styles.navArrow}>›</Text>
                </TouchableOpacity>
            </View>

            {/* カレンダーグリッド（ビュー切替アニメーション付き） */}
            <View style={styles.calendarContainer}>
                {isMonthView ? (
                    <Animated.View
                        key="month"
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(150)}
                    >
                        <CalendarMonthGrid
                            year={year}
                            month={month}
                            selectedDay={selectedDay}
                            dayInfoMap={dayInfoMap}
                            weekStartDay={weekStartDay}
                            onSelectDay={setSelectedDay}
                        />
                    </Animated.View>
                ) : (
                    <Animated.View
                        key="week"
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(150)}
                    >
                        <CalendarWeekStrip
                            weekDates={weekDates}
                            selectedDay={selectedDay}
                            dayInfoMap={dayInfoMap}
                            weekStartDay={weekStartDay}
                            onSelectDay={setSelectedDay}
                        />
                    </Animated.View>
                )}
            </View>

            {/* 選択日の日記 + 動画一覧 */}
            {selectedDay !== null && (
                <View style={styles.panelContainer}>
                    <View style={styles.panelHeader}>
                        <Text style={styles.panelTitle}>{panelTitle}</Text>
                        <Text style={styles.panelCount}>
                            {selectedDateVideos.length}件
                        </Text>
                    </View>

                    <FlatList
                        data={selectedDateVideos}
                        keyExtractor={(item) => item.id}
                        ListHeaderComponent={
                            <DiaryCard
                                diary={diary}
                                onPress={() => setDiaryModalVisible(true)}
                            />
                        }
                        renderItem={({ item }) => (
                            <VideoCardCompact
                                video={item}
                                onPress={() => handleVideoPress(item.id)}
                            />
                        )}
                        ItemSeparatorComponent={() => (
                            <View style={styles.separator} />
                        )}
                        ListEmptyComponent={
                            <View style={styles.panelEmpty}>
                                <Text style={styles.panelEmptyText}>
                                    この日の動画はありません
                                </Text>
                            </View>
                        }
                    />
                </View>
            )}

            {/* Diary edit modal */}
            {selectedDateKey != null && (
                <DiaryEditModal
                    visible={diaryModalVisible}
                    dateKey={selectedDateKey}
                    diary={diary}
                    onSave={saveDiary}
                    onDelete={removeDiary}
                    onClose={handleDiaryClose}
                />
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
        textAlign: "center",
    },
    viewModeHint: {
        fontSize: 11,
        color: Colors.textTertiary,
        textAlign: "center",
        marginTop: 2,
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
