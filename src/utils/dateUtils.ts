/**
 * 日時フォーマットユーティリティ
 */

/**
 * Unix timestamp（秒）を日本語形式の日付文字列に変換する
 * 例: 1735689600 → "2025年1月1日"
 */
export function formatDate(unixTimestamp: number): string {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

/**
 * Unix timestamp（秒）を短い日付形式に変換する
 * 例: 1735689600 → "2025/01/01"
 */
export function formatDateShort(unixTimestamp: number): string {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
}

/**
 * 秒数を "mm:ss" 形式に変換する
 * 例: 185 → "3:05"
 */
export function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Unix timestamp（秒）を "YYYY-MM-DD" 形式の文字列に変換する
 * カレンダーの日付マーカー比較に使用
 */
export function toDateKey(unixSec: number): string {
    const d = new Date(unixSec * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * 指定した年月の月初 Unix タイムスタンプ（秒）を返す
 * @param month 1-based
 */
export function startOfMonth(year: number, month: number): number {
    return Math.floor(new Date(year, month - 1, 1, 0, 0, 0, 0).getTime() / 1000);
}

/**
 * 指定した年月の月末 Unix タイムスタンプ（秒）を返す
 * @param month 1-based
 */
export function endOfMonth(year: number, month: number): number {
    // 翌月0日 = 当月末日
    return Math.floor(new Date(year, month, 0, 23, 59, 59, 999).getTime() / 1000);
}
