# SnowLog 技術仕様書

最終更新: 2026-04-08
対象バージョン: v1.0.0
基準: `main` ブランチの現行実装

---

## 1. 文書の目的

本書は、SnowLog の**現在の実装状態**を共有するための技術仕様書である。
企画案や理想像ではなく、`src/app` / `src/hooks` / `src/services` / `src/database` に存在するコードを基準に、現時点での機能・責務・データ構造・プラットフォーム差分を整理する。

---

## 2. プロダクト概要

- **目的**: スキー・スノーボード動画をローカルで整理し、あとから素早く振り返れる個人用ログアプリを提供する。
- **主な利用者**: 撮影本数が多く、クラウド共有よりも「整理しやすさ」「練習ログ化」「あとからの見返しやすさ」を重視する個人スキーヤー / スノーボーダー。
- **中核価値**:
    - 動画にゲレンデ名・タイトル・メモ・タグ・滑走種別を付けて残せる
    - ホーム / カレンダー / 検索 / 統計から違う切り口で振り返れる
    - お気に入りや日記によって、単なる保存ではなく「思い出と練習記録の両方」を蓄積できる
- **データ方針**: ユーザーデータはローカル SQLite を中心に保持し、動画の一覧・属性・日記・設定を端末内で管理する。

---

## 3. 対応プラットフォーム

| プラットフォーム | 状態 | 補足 |
|---|---|---|
| iOS | 主対象 / 機能が最も充実 | フォトライブラリ連携、iCloud アセット取得、写真アプリ導線あり |
| Android | 対応済み | `content://` URI を含むインポート経路に対応 |
| Web | プレビュー用途 | SQLite / MediaLibrary 非対応のため、主にモック・スタブで画面確認を行う |

補足:
- Web は機能等価な本番実装ではなく、UI プレビュー用途の簡易実装である。
- iOS / Android のネイティブ機能を使う画面では、Web 側にスタブが置かれている場合がある。

---

## 4. アプリ全体構成

### 4.1 ルート構成

- ルートは Expo Router ベース。
- `src/app/_layout.tsx` が起点となり、マイグレーション完了後に各画面を表示する。
- メイン導線は `src/app/(tabs)` 配下の 5 タブ構成。
- 個別画面として、動画インポート、動画詳細、各種設定画面を Stack で管理する。

### 4.2 タブ構成

| タブ | 役割 | 主な内容 |
|---|---|---|
| `index` | ホーム | ゲレンデ別タイムライン、全件 / お気に入り切り替え、一括選択 |
| `dashboard` | 統計 | シーズン単位の集計、ゲレンデ別ランキング、種別分布、月別推移 |
| `calendar` | カレンダー | 月 / 週表示、日別動画一覧、日記表示・編集 |
| `search` | 検索 | テキスト、ゲレンデ、タグ、期間プリセットによる絞り込み |
| `settings` | 設定 | カレンダー設定、滑走種別管理、お気に入りゲレンデ管理、タグ管理、重複候補確認 |

### 4.3 Stack で管理される主な画面

- `video-import`
- `video/[id]`
- `settings/calendar`
- `settings/techniques`
- `settings/favorite-resorts`
- `settings/tags`
- `settings/duplicate-candidates`

---

## 5. 起動時処理

アプリ起動時には、単に画面を出すだけでなく以下の初期化処理を実行する。

1. Drizzle migration を実行
2. デフォルトの滑走種別候補を差分シード
3. `capturedAt` が不正な動画レコードを修復

### 5.1 滑走種別候補のシード

- `DEFAULT_TECHNIQUE_OPTIONS` を基準に、未登録の種別だけ追加する。
- 既存ユーザーデータを壊さず、差分だけ補充する方式を採用している。

### 5.2 `capturedAt` 修復

- 初回または修復バージョン更新時は全動画をスキャンする。
- 以後は、明らかに不正なタイムスタンプだけを高速チェックする。
- 修復時は MediaLibrary の `creationTime` を参照し、必要なら DB を更新する。
- iCloud 専用アセットやメタデータ取得失敗は、起動を止めずにスキップする。

---

## 6. データモデル

### 6.1 中心テーブル

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
    techniques: text("techniques"),
    isFileAvailable: int("is_file_available").notNull().default(1),
    isFavorite: int("is_favorite").notNull().default(0),
    createdAt: int("created_at").notNull(),
    updatedAt: int("updated_at").notNull(),
});
```

### 6.2 テーブル一覧

| テーブル | 役割 | 備考 |
|---|---|---|
| `videos` | 動画メタデータ本体 | `techniques` は JSON 文字列、`isFavorite` を保持 |
| `tags` | タグマスタ | 種別は `technique` / `skier` / `custom` |
| `video_tags` | 動画とタグの中間テーブル | 多対多を表現 |
| `technique_options` | 滑走種別の選択肢 | ユーザー追加・削除可 |
| `favorite_resorts` | お気に入りゲレンデ | 入力補完に利用 |
| `app_preferences` | 汎用 key-value 設定 | 現在は `weekStartDay` など |
| `diary_entries` | 日記エントリー | 1 日 1 レコード、`dateKey` 一意 |

### 6.3 重要な制約

- `videos.assetId` はユニーク
- `tags` は `(name, type)` の組み合わせでユニーク
- `diary_entries.dateKey` はユニーク

### 6.4 エンティティ関係

```text
videos --< video_tags >-- tags
   |
   +-- technique_options   (選択候補)
   +-- favorite_resorts    (入力補助)
   +-- app_preferences     (表示設定)
   +-- diary_entries       (日別ログ)
```

### 6.5 型上の補足

- UI 層では `VideoWithTags` を主に扱う。
- `videos.techniques` は DB では JSON 文字列だが、フック / 表示側では `string[] | null` として扱う。
- `FilterOptions` は `skiResortName` / `tagIds` / `dateFrom` / `dateTo` / `searchText` / `favoritesOnly` を持つ。

---

## 7. 主要ユーザーフロー

### 7.1 ホーム (`index`)

- 動画一覧を**ゲレンデ別セクション**にまとめて表示する。
- セグメント切り替えで「すべて」と「お気に入り」を往復できる。
- 動画カードの長押しで**一括選択モード**に入り、以下をまとめて実行できる。
    - お気に入り ON / OFF
    - 複数動画の削除
- 削除時は DB レコードだけでなく、サムネイルや managed 動画ファイルもクリーンアップする。

### 7.2 動画インポート (`video-import`)

#### 単体インポート

1. フォトライブラリ権限を要求
2. 1 本の動画を選択
3. 既存 `assetId` と照合して重複インポートを防止
4. EXIF / MediaLibrary から撮影日時と GPS を解決
5. 一時ステージングした URI を使ってサムネイル生成・保存
6. タイトル / ゲレンデ / メモ / タグ / 滑走種別を付けて保存

補足:
- iCloud 上のアセットは `shouldDownloadFromNetwork: true` で取得を試みる。
- `assetId` が返らない場合は `synthetic:` プレフィックス付き ID を発行する。

#### 一括インポート

- 一度に最大 **20 本** まで選択できる。
- 既存の `assetId` と一致する動画は自動で `skipped` 扱いにする。
- 各動画は順番にインポートされ、進捗 UI を表示する。
- GPS が取れた動画は、近いゲレンデ候補ごとにグループ化して確認ダイアログを出す。
- 確認後は対象グループに対して一括でゲレンデ名を反映する。
- ステージングファイルは各動画の処理後に即時削除する。

### 7.3 動画詳細 (`video/[id]`)

- `expo-video` を用いて動画再生を行う。
- タイトル・メモは debounce 付きの自動保存。
- ゲレンデ名・滑走種別・タグは画面から編集できる。
- お気に入りは即時トグル可能。
- 削除時は動画レコード、サムネイル、managed 動画ファイルを整理する。
- 元アセットが消えている場合は `isFileAvailable` を使って再生不可状態を表示する。
- iOS では、条件を満たす場合のみ写真アプリへ戻る導線を表示する。

### 7.4 カレンダー (`calendar`)

- 月表示 / 週表示を切り替えられる。
- `weekStartDay` 設定に応じて、週の開始曜日を月曜 / 日曜で変更できる。
- 各日には以下の集約情報を載せる。
    - 動画本数
    - 代表サムネイル
    - ゲレンデ色ドット
    - 日記の有無
- 日付選択時は、その日の動画一覧と日記カードを下部に表示する。
- 日記は `DiaryEditModal` で作成 / 更新 / 削除できる。

#### 日記で保持する主な項目

- `skiResortName`
- `weather`
- `snowCondition`
- `impressions`
- `temperature`
- `companions`
- `fatigueLevel`
- `expenses`
- `numberOfRuns`

### 7.5 検索 (`search`)

- `FilterBar` で以下の条件を組み合わせて絞り込みできる。
    - テキスト検索
    - ゲレンデ名
    - タグ
    - 期間プリセット（今月 / 先月 / 今シーズン）
- テキスト検索は UI 上はタイトル・メモ中心の導線だが、実装上はファイル名も検索対象に含む。
- フィルタ結果は件数付きで一覧表示する。
- ダッシュボードから検索画面へドリルダウンする用途もある。

### 7.6 統計 (`dashboard`)

- 集計単位は**シーズン**で、定義は **11 月〜翌年 5 月**。
- シーズン切り替え UI により、過去シーズンを選択できる。
- 主な表示内容:
    - `summary`（滑走日数、動画数、総再生時間、ゲレンデ数、お気に入り数）
    - `resortRanking`（訪問日数・動画数・最終訪問日）
    - `techniqueDistribution`（滑走種別の分布）
    - `monthlyTrend`（月別の動画数 / 滑走日数）
    - `heatmapDays`（日別密度）
    - `recentVideos`（最近の動画）
- 一部カードから検索画面へ条件付き遷移できる。

### 7.7 設定 (`settings`)

現在の設定メニューは以下の 5 項目。

1. カレンダー設定
2. 滑走種別の管理
3. お気に入りスキー場
4. タグの管理
5. 重複候補の確認

#### カレンダー設定

- 週の開始曜日を `monday` / `sunday` で保存する。

#### 滑走種別の管理

- `technique_options` に対する追加・削除を行う。
- 既存動画に設定済みの値は削除しても自動書き換えしない。

#### お気に入りスキー場

- `SkiResortSearch` で候補検索し、入力補完に使うゲレンデを保存する。

#### タグの管理

- 現在は主に `custom` タグの追加・削除を行う。
- 削除時は中間テーブル `video_tags` からも関連付けを除去する。

#### 重複候補の確認

- 似ている動画を自動検出し、グループ単位で確認できる。
- ここから候補動画の削除を実行できる。

---

## 8. 重複候補判定ロジック

重複候補は、以下の情報を組み合わせてスコアリングする。

- 動画長の差
- 撮影時刻の差
- 正規化したファイル名の一致 / 類似
- ゲレンデ名の一致

代表的な判定条件:

- ファイル名がほぼ一致し、長さの差が 2 秒以内
- 撮影時刻の差が 5 秒以内で、長さの差が 1 秒以内
- 総合スコアが一定以上

検出後は、ペア単位ではなく**連結グラフとしてグループ化**し、`high` / `medium` の信頼度を付与する。

---

## 9. リポジトリ / フック / サービスの責務分担

### 9.1 Repository

| 層 | ファイル | 主責務 |
|---|---|---|
| Repository | `videoRepository.ts` | 動画 CRUD、絞り込み、favorite 切替、一括 favorite、削除 |
| Repository | `tagRepository.ts` | タグ CRUD、動画との関連付け、カスタムタグ削除 |
| Repository | `favoriteResortRepository.ts` | お気に入りゲレンデの管理 |
| Repository | `techniqueOptionRepository.ts` | 滑走種別候補の管理 |
| Repository | `dashboardRepository.ts` | シーズン統計の集計 |
| Repository | `diaryEntryRepository.ts` | 日記の取得、範囲検索、upsert、削除 |
| Repository | `appPreferenceRepository.ts` | key-value 設定の保存 |

### 9.2 Hook

| Hook | 主責務 |
|---|---|
| `useVideos` | フィルタ条件に応じた動画一覧取得 |
| `useVideoDetail` | 動画詳細の取得、更新、削除、ファイル存在確認 |
| `useCalendarEnhanced` | 月 / 週表示、DayInfo 集約、日記存在の統合 |
| `useDiaryEntry` | 日記 1 件の読み書き |
| `useDashboard` | シーズン選択と統計取得 |
| `useAppPreference` | 設定値の読み書き |
| `useSelectionMode` | 一括選択モードの状態管理 |

### 9.3 Service

| Service | 主責務 |
|---|---|
| `mediaService.ts` | MediaLibrary 権限、アセット取得、iCloud ダウンロード付き再取得 |
| `importService.ts` | インポート保存、サムネイル生成、タグ反映 |
| `managedVideoFileService.ts` | synthetic 動画のアプリ内保存 |
| `thumbnailService.ts` | サムネイル生成 / 削除 |
| `duplicateDetectionService.ts` | 重複候補のスコアリングとグルーピング |
| `videoDeletionService.ts` | 動画削除時のクリーンアップ統合 |
| `exportService.ts` | JSON バックアップ生成と共有 |

---

## 10. メディア保存ポリシー

### 10.1 通常のフォトライブラリアセット

- 基本的には `assetId` を保持し、元動画は MediaLibrary 側を参照する。
- サムネイルのみアプリ管理領域へ保存する。

### 10.2 Synthetic import

- picker が `assetId` を返さない場合、`synthetic:` 付き ID を採番する。
- この場合は元 URI をそのまま参照せず、`documentDirectory/videos/` 配下へコピーして保持する。
- Android の `content://` URI も managed 保存対象として扱える。

### 10.3 サムネイル

- サムネイルは `documentDirectory/thumbnails/` 配下へ JPEG として保存する。
- 動画削除時にはサムネイルも削除する。

### 10.4 ファイル欠損時の扱い

- 元アセットが消えた、または managed 動画が見つからない場合は `isFileAvailable` を使って再生不可を表現する。
- データは残しつつ、再生 UI 側で利用不能を明示する。

---

## 11. バックアップ / エクスポート

`exportService.ts` には、全データを JSON として書き出して共有シートを開く処理が実装されている。

### 11.1 エクスポート対象

- `videos`
- `tags`
- `techniqueOptions`
- `favoriteResorts`
- `diaryEntries`
- `preferences`

### 11.2 現在の位置づけ

- サービス実装は存在するが、現時点では主要 UI からの導線は限定的である。
- そのため、本機能は「実装済みのバックアップ基盤」として扱うのが正確である。

---

## 12. プラットフォーム差分メモ

### 12.1 iOS

- 主なターゲットプラットフォーム。
- iCloud 上のアセット取得に対応。
- 詳細画面では、条件付きで写真アプリへ戻るリンクを表示する。

### 12.2 Android

- `android.package` を設定済み。
- `content://` URI を含むインポート経路に対応。
- iOS 専用の写真アプリ導線は表示しない。

### 12.3 Web

- SQLite / MediaLibrary / Sharing の制約上、本番相当の機能提供はしない。
- `*.web.ts` / `*.web.tsx` ではモックやアラートベースの代替実装を用いる。
- 目的は、主にレイアウト確認と簡易 UI プレビューである。

---

## 13. 現在の仕様として重要なポイント

古い仕様書との差分として、特に以下は現行実装で重要である。

1. タブは 4 つではなく **5 タブ**（`dashboard` を含む）
2. 日記機能 `diary_entries` が存在する
3. 動画は `isFavorite` を持つ
4. 一括選択・一括お気に入り・一括削除がホームにある
5. 重複候補確認画面が設定にある
6. Android のインポート経路を考慮した実装になっている
7. JSON バックアップ基盤が実装済みである

---

## 14. 今後この文書を更新すべきタイミング

以下の変更が入った場合は、本書も更新対象とする。

- タブ構成の変更
- DB スキーマ変更
- インポート / 削除 / バックアップ仕様の変更
- 新しい設定画面の追加
- プラットフォーム対応範囲の変更
- ダッシュボード集計項目の変更

本書は README より技術寄り、コードコメントより俯瞰的、実装よりも先回りしすぎないレベルで維持するのが望ましい。
