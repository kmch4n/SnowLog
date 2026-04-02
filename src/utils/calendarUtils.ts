import type { WeekStartDay } from "@/types";

/**
 * カレンダー計算のための純粋関数群
 */

const DAY_LABELS_MONDAY = ["月", "火", "水", "木", "金", "土", "日"];
const DAY_LABELS_SUNDAY = ["日", "月", "火", "水", "木", "金", "土"];

/** 週の開始曜日に応じた曜日ラベル配列を返す */
export function getDayLabels(weekStartDay: WeekStartDay): string[] {
    return weekStartDay === "monday" ? DAY_LABELS_MONDAY : DAY_LABELS_SUNDAY;
}

/**
 * 月初の空白セル数（オフセット）を計算する
 * @param month 1-based
 */
export function getMonthOffset(
    year: number,
    month: number,
    weekStartDay: WeekStartDay
): number {
    const jsDay = new Date(year, month - 1, 1).getDay(); // 0=日, 1=月, ..., 6=土
    if (weekStartDay === "monday") {
        return jsDay === 0 ? 6 : jsDay - 1;
    }
    return jsDay;
}

/**
 * 基準日 + オフセットから、1週間分の Date 配列を返す
 * @param referenceDate 基準日（通常は今日）
 * @param weekOffset 0 = 基準日を含む週、-1 = 前の週、+1 = 次の週
 */
export function getWeekDates(
    referenceDate: Date,
    weekOffset: number,
    weekStartDay: WeekStartDay
): Date[] {
    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);

    // 基準日の曜日インデックス（weekStartDay 基準で 0〜6）
    const jsDay = ref.getDay();
    const dayIndex = weekStartDay === "monday"
        ? (jsDay === 0 ? 6 : jsDay - 1)
        : jsDay;

    // 週の開始日を求める
    const startDate = new Date(ref);
    startDate.setDate(startDate.getDate() - dayIndex + weekOffset * 7);

    // 7日分の Date を生成
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        dates.push(d);
    }
    return dates;
}

/**
 * 7つの Date 配列から dateFrom / dateTo（Unix 秒）を返す
 */
export function getWeekDateRange(dates: Date[]): {
    dateFrom: number;
    dateTo: number;
} {
    const first = new Date(dates[0]);
    first.setHours(0, 0, 0, 0);

    const last = new Date(dates[dates.length - 1]);
    last.setHours(23, 59, 59, 999);

    return {
        dateFrom: Math.floor(first.getTime() / 1000),
        dateTo: Math.floor(last.getTime() / 1000),
    };
}

/**
 * 指定日が月内の第何週かを返す（1-based）
 */
export function getWeekNumber(date: Date, weekStartDay: WeekStartDay): number {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const firstOffset = weekStartDay === "monday"
        ? (firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1)
        : firstOfMonth.getDay();

    return Math.ceil((date.getDate() + firstOffset) / 7);
}

/**
 * 列インデックスが土曜かどうかを判定する
 */
export function isSaturdayColumn(
    colIndex: number,
    weekStartDay: WeekStartDay
): boolean {
    // 月曜始まり: 土=5, 日曜始まり: 土=6
    return weekStartDay === "monday" ? colIndex === 5 : colIndex === 6;
}

/**
 * 列インデックスが日曜かどうかを判定する
 */
export function isSundayColumn(
    colIndex: number,
    weekStartDay: WeekStartDay
): boolean {
    // 月曜始まり: 日=6, 日曜始まり: 日=0
    return weekStartDay === "monday" ? colIndex === 6 : colIndex === 0;
}
