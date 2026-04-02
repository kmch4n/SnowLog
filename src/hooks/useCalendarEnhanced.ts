import { useCallback, useMemo, useState } from "react";

import { useAppPreference } from "./useAppPreference";
import { useVideos } from "./useVideos";
import {
    getWeekDateRange,
    getWeekDates,
    getWeekNumber,
} from "@/utils/calendarUtils";
import { endOfMonth, startOfMonth, toDateKey } from "@/utils/dateUtils";
import type {
    CalendarViewMode,
    DayInfo,
    FilterOptions,
    WeekStartDay,
} from "@/types";

/**
 * 拡張カレンダーフック
 * - 月表示 / 週表示の切り替え
 * - weekStartDay 設定の反映
 * - DayInfo マップ（リッチセル用）
 */
export function useCalendarEnhanced() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1); // 1-based
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
    const [weekOffset, setWeekOffset] = useState(0);

    const [weekStartDay] = useAppPreference("weekStartDay", "monday");
    const typedWeekStartDay = weekStartDay as WeekStartDay;

    // --- フィルター ---

    const monthFilter = useMemo<FilterOptions>(
        () => ({
            dateFrom: startOfMonth(year, month),
            dateTo: endOfMonth(year, month),
        }),
        [year, month]
    );

    const weekDates = useMemo(
        () => getWeekDates(new Date(), weekOffset, typedWeekStartDay),
        [weekOffset, typedWeekStartDay]
    );

    const weekFilter = useMemo<FilterOptions>(
        () => getWeekDateRange(weekDates),
        [weekDates]
    );

    const activeFilter = useMemo(
        () => (viewMode === "month" ? monthFilter : weekFilter),
        [viewMode, monthFilter, weekFilter]
    );

    const { videos, isLoading } = useVideos(activeFilter);

    // --- DayInfo マップ ---

    const dayInfoMap = useMemo(() => {
        const map = new Map<string, DayInfo>();
        for (const v of videos) {
            const key = toDateKey(v.capturedAt);
            const existing = map.get(key);
            if (existing) {
                existing.videoCount++;
                if (
                    v.skiResortName &&
                    !existing.resortNames.includes(v.skiResortName)
                ) {
                    existing.resortNames.push(v.skiResortName);
                }
            } else {
                map.set(key, {
                    dateKey: key,
                    videoCount: 1,
                    resortNames: v.skiResortName ? [v.skiResortName] : [],
                    thumbnailUri: v.thumbnailUri,
                });
            }
        }
        return map;
    }, [videos]);

    // --- 選択日の動画 ---

    const selectedDateVideos = useMemo(() => {
        if (selectedDay === null) return [];

        if (viewMode === "month") {
            const key = `${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
            return videos.filter((v) => toDateKey(v.capturedAt) === key);
        }

        // 週表示: weekDates から該当日を探す
        const targetDate = weekDates.find((d) => d.getDate() === selectedDay);
        if (!targetDate) return [];
        const key = toDateKey(Math.floor(targetDate.getTime() / 1000));
        return videos.filter((v) => toDateKey(v.capturedAt) === key);
    }, [selectedDay, videos, year, month, viewMode, weekDates]);

    // --- 週表示のタイトル情報 ---

    const weekTitle = useMemo(() => {
        if (weekDates.length === 0) return "";
        const first = weekDates[0];
        const y = first.getFullYear();
        const m = first.getMonth() + 1;
        const weekNum = getWeekNumber(first, typedWeekStartDay);
        return `${y}年${m}月 第${weekNum}週`;
    }, [weekDates, typedWeekStartDay]);

    // --- ナビゲーション ---

    const prevMonth = useCallback(() => {
        setSelectedDay(null);
        if (month === 1) {
            setYear((y) => y - 1);
            setMonth(12);
        } else {
            setMonth((m) => m - 1);
        }
    }, [month]);

    const nextMonth = useCallback(() => {
        setSelectedDay(null);
        if (month === 12) {
            setYear((y) => y + 1);
            setMonth(1);
        } else {
            setMonth((m) => m + 1);
        }
    }, [month]);

    const prevWeek = useCallback(() => {
        setSelectedDay(null);
        setWeekOffset((o) => o - 1);
    }, []);

    const nextWeek = useCallback(() => {
        setSelectedDay(null);
        setWeekOffset((o) => o + 1);
    }, []);

    const toggleViewMode = useCallback(() => {
        setViewMode((m) => (m === "month" ? "week" : "month"));
        setSelectedDay(null);
    }, []);

    return {
        // 共通
        year,
        month,
        selectedDay,
        setSelectedDay,
        viewMode,
        toggleViewMode,
        weekStartDay: typedWeekStartDay,
        dayInfoMap,
        selectedDateVideos,
        isLoading,
        // 月表示
        prevMonth,
        nextMonth,
        // 週表示
        weekDates,
        weekTitle,
        prevWeek,
        nextWeek,
    };
}
