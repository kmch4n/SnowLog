import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 動画テーブル
 * 動画ファイルのコピーは保持しない（参照方式）
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
    createdAt: int("created_at").notNull(),
    updatedAt: int("updated_at").notNull(),
});

/**
 * タグマスターテーブル
 */
export const tags = sqliteTable("tags", {
    id: int("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    // 'technique' | 'skier' | 'custom'
    type: text("type").notNull(),
});

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

export type VideoInsert = typeof videos.$inferInsert;
export type VideoSelect = typeof videos.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;
export type TagSelect = typeof tags.$inferSelect;
export type VideoTagInsert = typeof videoTags.$inferInsert;
export type TechniqueOptionInsert = typeof techniqueOptions.$inferInsert;
export type TechniqueOptionSelect = typeof techniqueOptions.$inferSelect;
