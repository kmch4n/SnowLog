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
