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
}

// 動画インポート時に必要なメタデータ
export interface ImportMetadata {
    title: string | null;
    skiResortName: string | null;
    memo: string;
    tagIds: number[];
    techniques: string[];
}
