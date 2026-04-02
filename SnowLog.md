# SnowLog 技術仕様書

最終更新: 2026-04-02
対象バージョン: v0.1 (MVP)

---

## 1. プロダクト概要
- **目的**: iPhone で撮影した滑走動画・メモをローカルで整理し、ゲレンデ別/日付別/タグ別にすぐ振り返れるようにする。
- **ユーザーペルソナ**: 個人スキーヤー・スノーボーダー。撮影本数が多く、クラウド共有よりも素早い整理とトレーニングログ化を優先する層。
- **価値仮説**: 撮影直後に SnowLog へ取り込むだけでタイムライン・カレンダー・タグ管理が自動整備され、練習計画の意思決定コストを下げられる。

---

## 2. システムアーキテクチャ
### 2.1 クライアント構成
- Expo Router v4 を採用し、`src/app/_layout.tsx` をルート Stack としてネイティブタブ (`src/app/(tabs)`)・動画詳細 (`src/app/video/[id].tsx`)・インポートモーダル (`src/app/video-import.tsx`) を統括。
- 画面分割は以下の 4 タブ:
    1. `index`(ホーム: ゲレンデ別タイムライン)
    2. `calendar`(月/週カレンダー)
    3. `search`(フィルタ + リスト)
    4. `settings`(各種設定ランチャー)

### 2.2 永続化レイヤー
- `expo-sqlite` + Drizzle ORM を利用。DB 接続は `src/database/index.ts` の `db` が単一エントリポイント。
- マイグレーションは `drizzle/` 配下に SQL 生成済み。`npm run db:generate` でスキーマ変更を反映。
- 変更検知のため `openDatabaseSync("snowlog.db", { enableChangeListener: true })` を使用し、UI 側で即時再読込を行うフック (`useVideos`, `useAppPreference`) が存在。

### 2.3 メディア連携
- **動画取得**: `expo-image-picker` + `expo-media-library`。iCloud アセットは `MediaLibrary.getAssetInfoAsync(..., { shouldDownloadFromNetwork: true })` でフェッチ。
- **サムネイル生成**: `expo-video-thumbnails` で 0 秒付近のフレームを JPEG として `FileSystem.documentDirectory/thumbnails` に保存。
- **再生**: `expo-video` の `VideoView` + `useVideoPlayer`。

### 2.4 主な依存パッケージ
| カテゴリ | ライブラリ | 用途 |
|----------|-----------|------|
| UI | expo-router / react-native-reanimated | 画面遷移、アニメーション |
| データ | drizzle-orm / zod | 型付 DB 操作、入力検証 (今後予定) |
| 位置/GPS | 自前 geoUtils + Haversine | EXIF/GPS からゲレンデ距離算出 |
| 共有 | expo-sharing | JSON 書き出しと共有 |

---

## 3. データモデル
スキーマ定義は `src/database/schema.ts` に集約。

```ts
export const videos = sqliteTable("videos", {
    id: text("id").primaryKey(),
    assetId: text("asset_id").notNull().unique(),
    filename: text("filename").notNull(),
    thumbnailUri: text("thumbnail_uri").notNull(),
    duration: int("duration").notNull().default(0),
    capturedAt: int("captured_at").notNull(),
    skiResortName: text("ski_resort_name"),
    memo: text("memo").notNull().default(""),
    title: text("title"),
    techniques: text("techniques"), // JSON string
    isFileAvailable: int("is_file_available").notNull().default(1),
    createdAt: int("created_at").notNull(),
    updatedAt: int("updated_at").notNull(),
});
```

### 3.1 テーブル一覧
| テーブル | 役割 | 備考 |
|----------|------|------|
| `videos` | 動画メタデータ | `techniques` は JSON 文字列 (`string[]`) |
| `tags` / `video_tags` | タグマスタ・多対多関係 | `TagType = "technique" | "skier" | "custom"`
| `technique_options` | UI で選べるテクニック候補 | 初期データは `_layout.tsx` でシード |
| `favorite_resorts` | よく使うゲレンデ候補 | `settings/favorite-resorts.tsx` から CRUD |
| `app_preferences` | Key-Value 形式の設定 | 週開始曜日など |

### 3.2 エンティティ関連図 (簡易)
```
videos --< video_tags >-- tags
   |
   +-- technique_options (候補リスト)
   +-- favorite_resorts (入力補助)
   +-- app_preferences (表示設定)
```

---

## 4. アプリ主要フロー
### 4.1 動画インポート (`src/app/video-import.tsx`)
1. ImagePicker でアセット選択。
2. `getAssetInfoWithDownload` が localUri / creationTime / GPS を取得。
3. `stageAssetFile` で `FileSystem.cacheDirectory` に一時コピー。
4. `generateAndSaveThumbnail` がサムネイル生成。
5. `importVideo` が `videos` へ Insert、タグ設定を `setTagsForVideo` で適用。
6. バルク処理時は最大 20 本をキュー化し、`BulkImportProgress` で可視化。GPS 未取得アセットは `GpsConfirmationDialog` で後から一括紐付け。

### 4.2 動画詳細編集 (`src/app/video/[id].tsx` + `useVideoDetail`)
- タイトル/メモは 1 秒の debounce 後に `updateVideoMeta` を呼び出し、`setTimeout` で保存ステータスをトースト表示。
- タグ編集は `TagSelector` → `setTagsForVideo`。
- ファイル欠損チェックは `checkAssetExists`(MediaLibrary False を返したら `isFileAvailable` を 0 へ更新予定)。
- 削除時はサムネイルを `deleteThumbnail` → `deleteVideo`。

### 4.3 カレンダー集計 (`src/hooks/useCalendarEnhanced.ts`)
- `useVideos(filter)` が Drizzle から該当期間の動画を抽出。
- `toDateKey` で日付 key を生成し、`Map<string, DayInfo>` に集約。`thumbnailUri` は最初の動画を代表値として利用。
- 週ビューは `getWeekDates` と `getWeekDateRange` で連続 7 日を求め、`weekOffset` をインクリメント/デクリメントしてページング。
- 週開始曜日 (`weekStartDay`) は `useAppPreference` で永続化。

### 4.4 検索 / フィルタ
- `FilterBar` が `SkiResortSearch` とタグチップを束ね、`FilterOptions` を `useVideos` に渡す。
- `getVideosByFilter` は `AND` 条件を構築し、タグ条件は中間テーブル経由で `video_ids` を絞り込み。

### 4.5 エクスポート (`src/services/exportService.ts`)
- `getAllVideos` + `getTagsForVideo` を全件 fetch。
- JSON フォーマット:
```json
{
    "exportedAt": "2026-04-02T...Z",
    "totalCount": 42,
    "videos": [
        {
            "id": "...",
            "filename": "IMG_1234.MOV",
            "capturedAt": "2026-03-12",
            "duration": 52,
            "skiResortName": "Hakuba47",
            "memo": "朝イチの圧雪",
            "tags": [{"name": "180", "type": "technique"}],
            "thumbnailUri": "file:///...jpg",
            "isFileAvailable": true
        }
    ]
}
```
- `expo-sharing` で共有し、Sharing が無効なプラットフォームでは例外を投げる。

---

## 5. サービス / リポジトリ対応表
| レイヤー | ファイル | 主責務 |
|----------|----------|--------|
| Repository | `videoRepository.ts` | CRUD + フィルタ、`updateVideoCapturedAt` など保守ロジック |
| Repository | `tagRepository.ts` | タグ CRUD、多対多関係の設定 |
| Repository | `favoriteResortRepository.ts` | お気に入りゲレンデリスト |
| Repository | `techniqueOptionRepository.ts` | テクニック候補、挿入時は現在件数を `sortOrder` に採用 |
| Service | `importService.ts` | Expo MediaLibrary をラップして DB へ保存 |
| Service | `mediaService.ts` | 権限チェック、アセット取得、存在確認 |
| Service | `thumbnailService.ts` | サムネイル生成/削除 |
| Service | `exportService.ts` | JSON 出力と共有 |

---

## 6. 設定・ユーザー環境
- **アプリ設定**: `app_preferences` に key-value で保存。現在は `weekStartDay` のみ実装。
- **お気に入りゲレンデ**: `favorite_resorts` に保存。`SkiResortSearch` で入力補完に使用。
- **タグ / テクニック**: 設定タブからカスタム項目を追加。テクニック候補は `_layout.tsx` の `seedTechniqueOptions` が初回起動時にデフォルト値を補充。

---

## 7. ビルド・運用・スクリプト
| コマンド | 用途 |
|----------|------|
| `npm run start` | Expo DevTools の起動 |
| `npm run ios` / `npm run web` | プラットフォーム別プレビュー |
| `npm run lint` | ESLint (Expo preset) |
| `npm run db:generate` | Drizzle スキーマ → SQL 生成 |
| `npm run db:studio` | Drizzle Studio の起動 |

- キャッシュ破損時は `scripts/reset-project.js` を実行。
- 新規端末では `scripts/patchImageUtilsCache.js` (必要に応じて) を再適用。

---

## 8. 今後の拡張案
1. **メタデータ補完**: iOS で `asset.id` が `null` になるケースに備え、ファイルハッシュによる代替キーを検討。
2. **分析ビュー**: 技術タグ別の練習時間ヒートマップ、滑走距離推計など。
3. **クラウドバックアップ**: ローカル完結を保ちつつ、任意エクスポート先 (iCloud Drive など) を選択できるようにする。
4. **オフライン通知**: `isFileAvailable` が 0 になった動画をまとめて復旧するウィザードの追加。

---

本書に記載されていない挙動や例外ケースは、各コンポーネント/サービスの JSDoc およびソースコメントを参照してください。
