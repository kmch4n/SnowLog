import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppPreference } from "./useAppPreference";
import { useVideos } from "./useVideos";
import { getDiaryDateKeysInRange } from "@/database/repositories/diaryEntryRepository";
import { useTranslation } from "@/i18n/useTranslation";
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
    const { t } = useTranslation();
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

    // --- Diary presence ---

    const dateKeyRange = useMemo(() => {
        const from = activeFilter.dateFrom;
        const to = activeFilter.dateTo;
        if (from == null || to == null) return null;
        return { from: toDateKey(from), to: toDateKey(to) };
    }, [activeFilter]);

    const [diaryDateKeys, setDiaryDateKeys] = useState<Set<string>>(new Set());
    const [diaryRefreshKey, setDiaryRefreshKey] = useState(0);

    const refreshDiaryKeys = useCallback(() => {
        setDiaryRefreshKey((k) => k + 1);
    }, []);

    useEffect(() => {
        if (dateKeyRange == null) {
            setDiaryDateKeys(new Set());
            return;
        }
        getDiaryDateKeysInRange(dateKeyRange.from, dateKeyRange.to).then(
            (keys) => setDiaryDateKeys(new Set(keys))
        );
    }, [dateKeyRange, diaryRefreshKey]);

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
                    hasDiary: false,
                });
            }
        }
        // Overlay diary presence
        for (const dk of diaryDateKeys) {
            const existing = map.get(dk);
            if (existing) {
                existing.hasDiary = true;
            } else {
                map.set(dk, {
                    dateKey: dk,
                    videoCount: 0,
                    resortNames: [],
                    thumbnailUri: null,
                    hasDiary: true,
                });
            }
        }
        return map;
    }, [videos, diaryDateKeys]);

    // --- 選択日の dateKey ---

    const selectedDateKey = useMemo<string | null>(() => {
        if (selectedDay === null) return null;
        if (viewMode === "month") {
            return `${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
        }
        const targetDate = weekDates.find((d) => d.getDate() === selectedDay);
        if (!targetDate) return null;
        return toDateKey(Math.floor(targetDate.getTime() / 1000));
    }, [selectedDay, year, month, viewMode, weekDates]);

    // --- 選択日の動画 ---

    const selectedDateVideos = useMemo(() => {
        if (selectedDateKey === null) return [];
        return videos.filter((v) => toDateKey(v.capturedAt) === selectedDateKey);
    }, [selectedDateKey, videos]);

    // --- 週表示のタイトル情報 ---

    const weekTitle = useMemo(() => {
        if (weekDates.length === 0) return "";
        const first = weekDates[0];
        const y = first.getFullYear();
        const m = first.getMonth() + 1;
        const weekNum = getWeekNumber(first, typedWeekStartDay);
        return t("calendar.weekTitle", { year: y, month: m, week: weekNum });
    }, [weekDates, typedWeekStartDay, t]);

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
        selectedDateKey,
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
        refreshDiaryKeys,
    };
}
