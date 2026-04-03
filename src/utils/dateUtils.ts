/**
 * 日時フォーマットユーティリティ
 */

import type { Season } from "../types/dashboard";

/**
 * EXIF DateTimeOriginal 文字列をミリ秒タイムスタンプに変換する
 * EXIF 2.32 仕様の "YYYY:MM:DD HH:MM:SS" を ISO 8601 に変換してパースする。
 * パース失敗時は null を返す。
 */
export function parseExifDateTime(exifStr: string): number | null {
    // "2026:03:31 13:42:10" → "2026-03-31T13:42:10"
    const m = exifStr.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
    if (!m) return null;
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}`;
    const ts = new Date(iso).getTime();
    return Number.isFinite(ts) ? ts : null;
}

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
 * Unix timestamp（秒）を日本語形式の日時文字列に変換する
 * 例: 1735689600 → "2025年1月1日 14:30"
 */
export function formatDateTime(unixTimestamp: number): string {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/**
 * 小数秒を "1分12.5秒" 形式に変換する
 * 例: 72.483 → "1分12.5秒"
 */
export function formatDurationDecimal(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1);
    return m > 0 ? `${m}分${s}秒` : `${s}秒`;
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

// --- ダッシュボード用ユーティリティ ---

/**
 * シーズンオブジェクトを構築する（11月〜翌年5月）
 * @param startYear シーズン開始年（例: 2025 → 2025年11月〜2026年5月）
 */
export function buildSeason(startYear: number): Season {
    return {
        label: `${startYear}-${String(startYear + 1).slice(2)}`,
        startYear,
        endYear: startYear + 1,
        dateFrom: startOfMonth(startYear, 11),
        dateTo: endOfMonth(startYear + 1, 5),
    };
}

/** 現在の日時に基づいて現在のシーズンを返す */
export function getCurrentSeason(): Season {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    // 11月以降は今年開始のシーズン、10月以前は前年開始のシーズン
    const startYear = month >= 11 ? year : year - 1;
    return buildSeason(startYear);
}

/**
 * 秒数を "X時間Y分" 形式にフォーマットする（ダッシュボード表示用）
 * 例: 12240 → "3時間24分", 300 → "5分"
 */
export function formatDurationHM(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h === 0) return `${m}分`;
    return `${h}時間${m}分`;
}
