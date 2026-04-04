/**
 * アプリ全体で使用する型定義
 */

// タグの種別
export type TagType = "technique" | "skier" | "custom";

// タグ
export interface Tag {
    id: number;
    name: string;
    type: TagType;
}

// 動画レコード（DBから取得した生データ）
export interface Video {
    id: string;
    assetId: string;
    filename: string;
    thumbnailUri: string;
    duration: number; // 秒
    capturedAt: number; // Unix timestamp
    skiResortName: string | null;
    memo: string;
    // ユーザーが設定した任意のタイトル（null の場合は filename にフォールバック）
    title: string | null;
    // 滑走種別プリセットの選択状態（リポジトリ層でJSONパース済み）
    techniques: string[] | null;
    // 元ファイルが存在するかどうか（1: 存在する、0: 削除済み）
    isFileAvailable: number;
    // お気に入り状態（1: お気に入り、0: 通常）
    isFavorite: number;
    createdAt: number;
    updatedAt: number;
}

// タグを含む動画（表示用）
export interface VideoWithTags extends Video {
    tags: Tag[];
}

// スキー場マスターデータ
export interface SkiResort {
    id: number;
    name: string;
    prefecture: string;
    latitude?: number;  // GPS緯度（geocode-resorts.mjs で追加）
    longitude?: number; // GPS経度（geocode-resorts.mjs で追加）
}

// 動画一覧のフィルター条件
export interface FilterOptions {
    skiResortName?: string;
    tagIds?: number[];
    dateFrom?: number; // Unix timestamp
    dateTo?: number; // Unix timestamp
    searchText?: string;
    favoritesOnly?: boolean;
}

// 動画インポート時に必要なメタデータ
export interface ImportMetadata {
    title: string | null;
    skiResortName: string | null;
    memo: string;
    tagIds: number[];
    techniques: string[];
}

// 一括インポート: 個々の動画の進捗状態
export interface BulkImportItem {
    assetId: string;
    filename: string;
    status: "pending" | "importing" | "success" | "skipped" | "error";
    error?: string;
    videoId?: string;
    detectedResort?: string;
    detectedResortDistance?: number;
}

// 一括インポート: GPS スキー場グループ
export interface BulkImportGpsGroup {
    resortName: string;
    distanceKm: number;
    videoIds: string[];
    confirmed: boolean;
}

// カレンダー: 週の開始曜日
export type WeekStartDay = "monday" | "sunday";

// カレンダー: 表示モード
export type CalendarViewMode = "month" | "week";

// カレンダー: 1日分の集約情報
export interface DayInfo {
    dateKey: string;
    videoCount: number;
    resortNames: string[];      // ユニークなスキー場名（カラードット用、最大3件）
    thumbnailUri: string | null; // 最初の動画のサムネイル（週表示用）
    hasDiary: boolean;           // 日記エントリーの有無
}

// 日記エントリー
export interface DiaryEntry {
    id: number;
    dateKey: string;
    skiResortName: string | null;
    weather: string | null;
    snowCondition: string | null;
    impressions: string;
    temperature: number | null;
    companions: string | null;
    fatigueLevel: number | null;
    expenses: number | null;
    numberOfRuns: number | null;
    createdAt: number;
    updatedAt: number;
}
