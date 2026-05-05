import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CalendarMonthGrid } from "@/components/CalendarMonthGrid";
import { CalendarWeekStrip } from "@/components/CalendarWeekStrip";
import { DiaryCard } from "@/components/DiaryCard";
import { DiaryEditModal } from "@/components/DiaryEditModal";
import { Icon } from "@/components/ui/Icon";
import { Colors } from "@/constants/colors";
import { IconNames } from "@/constants/icons";
import { VideoCardCompact } from "@/components/VideoCardCompact";
import { useCalendarEnhanced } from "@/hooks/useCalendarEnhanced";
import { useDiaryEntry } from "@/hooks/useDiaryEntry";
import { useTranslation } from "@/i18n/useTranslation";

function formatMonthTitle(year: number, month: number, locale: "ja" | "en"): string {
    if (locale === "ja") return `${year}年 ${month}月`;
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
    });
}

function formatPanelTitle(month: number, day: number, locale: "ja" | "en"): string {
    if (locale === "ja") return `${month}月${day}日`;
    return new Date(2000, month - 1, day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

/**
 * カレンダー画面
 * 月次/週次カレンダーで動画の撮影日を確認し、日付タップで当日の動画一覧を表示する
 */
const NATIVE_TAB_BAR_HEIGHT = 50;

export default function CalendarScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t, locale } = useTranslation();
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
            ? formatPanelTitle(month, selectedDay, locale)
            : (() => {
                const d = weekDates.find((wd) => wd.getDate() === selectedDay);
                return d ? formatPanelTitle(d.getMonth() + 1, d.getDate(), locale) : "";
            })()
        : "";

    const listHeader = useMemo(() => (
        <>
            {/* ナビゲーションバー */}
            <View style={styles.navRow}>
                <TouchableOpacity
                    style={styles.navButton}
                    onPress={isMonthView ? prevMonth : prevWeek}
                    accessibilityRole="button"
                    accessibilityLabel={t("calendar.previousPeriod")}
                >
                    <Icon
                        name={IconNames.chevronLeft}
                        size={22}
                        color={Colors.alpineBlue}
                        weight="semibold"
                        fallback="‹"
                    />
                </TouchableOpacity>

                <TouchableOpacity onPress={toggleViewMode} activeOpacity={0.7}>
                    <Text style={styles.monthTitle}>
                        {isMonthView
                            ? formatMonthTitle(year, month, locale)
                            : weekTitle}
                    </Text>
                    <Text style={styles.viewModeHint}>
                        {isMonthView
                            ? t("calendar.switchToWeek")
                            : t("calendar.switchToMonth")}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navButton}
                    onPress={isMonthView ? nextMonth : nextWeek}
                    accessibilityRole="button"
                    accessibilityLabel={t("calendar.nextPeriod")}
                >
                    <Icon
                        name={IconNames.chevronRight}
                        size={22}
                        color={Colors.alpineBlue}
                        weight="semibold"
                        fallback="›"
                    />
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

            {/* 選択日のヘッダー + 日記カード */}
            {selectedDay !== null && (
                <>
                    <View style={styles.panelHeader}>
                        <Text style={styles.panelTitle}>{panelTitle}</Text>
                        <Text style={styles.panelCount}>
                            {t("calendar.videoCount", { count: selectedDateVideos.length })}
                        </Text>
                    </View>
                    <DiaryCard
                        diary={diary}
                        onPress={() => setDiaryModalVisible(true)}
                    />
                </>
            )}
        </>
    ), [
        isMonthView, year, month, selectedDay, dayInfoMap, weekStartDay,
        weekDates, weekTitle, panelTitle, selectedDateVideos.length, diary,
        prevMonth, nextMonth, prevWeek, nextWeek, toggleViewMode, setSelectedDay,
        t, locale,
    ]);

    return (
        <View style={styles.container}>
            <FlatList
                data={selectedDay !== null ? selectedDateVideos : []}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={listHeader}
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
                    selectedDay !== null ? (
                        <View style={styles.panelEmpty}>
                            <Text style={styles.panelEmptyText}>
                                {t("calendar.empty")}
                            </Text>
                        </View>
                    ) : null
                }
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: insets.bottom + NATIVE_TAB_BAR_HEIGHT },
                ]}
            />

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
    listContent: {
        flexGrow: 1,
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
