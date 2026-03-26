import { useCallback, useMemo, useState } from "react";

import { useVideos } from "./useVideos";
import type { FilterOptions } from "../types";
import { endOfMonth, startOfMonth, toDateKey } from "../utils/dateUtils";

/**
 * カレンダー画面のロジックを管理するフック
 * - 月ナビゲーション
 * - 動画がある日付のドットマーカー
 * - 選択日の動画一覧
 */
export function useCalendar() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1); // 1-based
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    /** useVideos に渡すフィルターをメモ化して参照安定化する */
    const monthFilter = useMemo<FilterOptions>(
        () => ({
            dateFrom: startOfMonth(year, month),
            dateTo: endOfMonth(year, month),
        }),
        [year, month]
    );

    const { videos, isLoading } = useVideos(monthFilter);

    /** 動画が存在する日付セット（"YYYY-MM-DD" 形式） */
    const datesWithVideos = useMemo(() => {
        const set = new Set<string>();
        for (const v of videos) {
            set.add(toDateKey(v.capturedAt));
        }
        return set;
    }, [videos]);

    /** 選択日の動画一覧 */
    const selectedDateVideos = useMemo(() => {
        if (selectedDay === null) return [];
        const key = `${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
        return videos.filter((v) => toDateKey(v.capturedAt) === key);
    }, [selectedDay, videos, year, month]);

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

    return {
        year,
        month,
        selectedDay,
        setSelectedDay,
        prevMonth,
        nextMonth,
        datesWithVideos,
        selectedDateVideos,
        isLoading,
    };
}
