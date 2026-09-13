import { sql } from "drizzle-orm";
import { int, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * 動画テーブル
 *
 * 保存方式は行ごとに `storageMode` が持つ。`reference` は写真ライブラリを参照し
 * アプリ側にバイトを持たない。`copy` はアプリ管理下にファイルを持ち、その相対
 * パスが `managedVideoPath` に入る（#86）。
 *
 * それ以前は「synthetic な assetId かどうか」が保存方式の判定を兼ねていたが、
 * ユーザーが方式を選べるようになると「写真ライブラリ上の身元があるか」と
 * 「バイトがどこにあるか」は一致しなくなる。身元の判定は今も
 * `isSyntheticAssetId` の仕事で、保存方式の判定だけがこの列に移った。
 */
export const videos = sqliteTable("videos", {
    id: text("id").primaryKey(),
    assetId: text("asset_id").notNull().unique(),
    filename: text("filename").notNull(),
    thumbnailUri: text("thumbnail_uri").notNull(),
    duration: int("duration").notNull().default(0),
    capturedAt: int("captured_at").notNull(),
    skiResortName: text("ski_resort_name"),
    memo: text("memo").notNull().default(""),
    // ユーザーが設定した任意のタイトル（null の場合は filename にフォールバック）
    title: text("title"),
    // 滑走種別プリセットの選択状態（JSON配列文字列 e.g. '["大回り","コブ"]'、null は未設定）
    techniques: text("techniques"),
    // 元ファイルが存在するかどうか（1: 存在する、0: 削除済み）
    isFileAvailable: int("is_file_available").notNull().default(1),
    // お気に入り状態（1: お気に入り、0: 通常）
    isFavorite: int("is_favorite").notNull().default(0),
    // 保存方式（'reference': 写真ライブラリ参照 / 'copy': アプリ管理下にコピー）
    storageMode: text("storage_mode").notNull().default("reference"),
    // copy のときの相対パス `videos/<video-id>.<ext>`、reference のときは null。
    // iOS はアプリコンテナを再配置するので絶対 URI を保存してはいけない。
    managedVideoPath: text("managed_video_path"),
    createdAt: int("created_at").notNull(),
    updatedAt: int("updated_at").notNull(),
}, (table) => [
    // 1 つのファイルを 2 行が所有することを表現できなくする。大文字小文字を
    // 区別しないファイルシステム上でも所有権を排他にするため lower() を挟む。
    // NULL 同士は衝突しないので reference 行はいくつでも並ぶ。
    uniqueIndex("videos_managed_video_path_unique").on(
        sql`lower(${table.managedVideoPath})`
    ),
]);

/**
 * タグマスターテーブル
 */
export const tags = sqliteTable("tags", {
    id: int("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    // 'technique' | 'skier' | 'custom'
    type: text("type").notNull(),
}, (table) => [
    uniqueIndex("tags_name_type_unique").on(table.name, table.type),
]);

/**
 * 動画↔タグ 中間テーブル
 */
export const videoTags = sqliteTable("video_tags", {
    videoId: text("video_id")
        .notNull()
        .references(() => videos.id, { onDelete: "cascade" }),
    tagId: int("tag_id")
        .notNull()
        .references(() => tags.id, { onDelete: "cascade" }),
});

/**
 * 滑走種別オプションテーブル
 * ユーザーが自由に追加・削除できる種別マスター
 */
export const techniqueOptions = sqliteTable("technique_options", {
    id: int("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    sortOrder: int("sort_order").notNull().default(0),
});

/**
 * お気に入りスキー場テーブル
 * ユーザーが素早く選択できるように登録するスキー場名の一覧
 */
export const favoriteResorts = sqliteTable("favorite_resorts", {
    id: int("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
});

export type VideoInsert = typeof videos.$inferInsert;
export type VideoSelect = typeof videos.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;
export type TagSelect = typeof tags.$inferSelect;
export type VideoTagInsert = typeof videoTags.$inferInsert;
export type TechniqueOptionInsert = typeof techniqueOptions.$inferInsert;
export type TechniqueOptionSelect = typeof techniqueOptions.$inferSelect;
export type FavoriteResortInsert = typeof favoriteResorts.$inferInsert;
export type FavoriteResortSelect = typeof favoriteResorts.$inferSelect;

/**
 * アプリ設定テーブル（汎用 key-value ストア）
 * 将来の設定追加時もマイグレーション不要
 */
export const appPreferences = sqliteTable("app_preferences", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
});

export type AppPreferenceInsert = typeof appPreferences.$inferInsert;
export type AppPreferenceSelect = typeof appPreferences.$inferSelect;

/**
 * 日記エントリーテーブル
 * 1日1エントリー（dateKey で一意）
 */
export const diaryEntries = sqliteTable("diary_entries", {
    id: int("id").primaryKey({ autoIncrement: true }),
    dateKey: text("date_key").notNull().unique(),          // "YYYY-MM-DD"
    skiResortName: text("ski_resort_name"),
    weather: text("weather"),                              // "sunny" | "cloudy" | etc.
    snowCondition: text("snow_condition"),                  // "powder" | "packed" | etc.
    impressions: text("impressions").notNull().default(""),
    temperature: int("temperature"),                        // Celsius
    companions: text("companions"),                         // free text
    fatigueLevel: int("fatigue_level"),                     // 1-5
    expenses: int("expenses"),                              // yen
    numberOfRuns: int("number_of_runs"),
    createdAt: int("created_at").notNull(),
    updatedAt: int("updated_at").notNull(),
});

export type DiaryEntryInsert = typeof diaryEntries.$inferInsert;
export type DiaryEntrySelect = typeof diaryEntries.$inferSelect;
