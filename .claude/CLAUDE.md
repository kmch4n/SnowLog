# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

思考・解答共に例外を除き、基本的に全て日本語で行ってください。
しかし、以下の項目に当てはまる際にはその限りではありません。

- 複雑な問題を解決する際
    → 複雑な問題を解決する場合、英語で思考をした方がより良い結果を得られると考えた場合には、英語で思考をしてもらって大丈夫です。ただし、その場合でも解答は日本語で生成することを忘れないでください。
- コミットメッセージを作成する際
    → コミットメッセージを作成するように指示された際には、英語で提案してください。ただし、後述のコミットメッセージのルールを参考にして作成することを忘れないでください。

コードは常に美しくあるべきです。Tab、Indent共にすべて4であるべきです。フォーマットは適宜行って下さい。

---

## Project Overview

SkiLog — スキーヤー向け動画管理・振り返りアプリケーション。

- **コンセプト:** 「撮って渡す」の先を担うアプリ。ゲレンデでの即時共有はAirDropに任せ、アプリは「整理・振り返り」に特化。
- **プラットフォーム:** React Native (Expo) / iOS優先
- **ローカルDB:** SQLite (expo-sqlite)
- **ファイル管理:** 参照方式（動画のコピーは作成しない。メタデータ + サムネイルのみ保持）

---

## Tech Stack

| レイヤー | 技術 |
|----------|------|
| フレームワーク | Expo SDK 55 / React Native |
| 言語 | TypeScript (strict) |
| ルーティング | Expo Router v4 (file-based) |
| タブナビゲーション | `expo-router/unstable-native-tabs`（NativeTabs / Liquid Glass） |
| ガラスエフェクト | expo-glass-effect |
| ローカルDB | expo-sqlite v15 + Drizzle ORM |
| 動画アクセス | expo-media-library |
| 動画インポート | expo-image-picker |
| 動画再生 | expo-video |
| サムネイル | expo-video-thumbnails |
| エクスポート共有 | expo-sharing |
| ID生成 | expo-crypto |
| スキー場マスターデータ | 自前 JSON（全国 230件超） |

---

## Coding Conventions

### 全般

- TypeScript を使用し、型安全性を重視する
- `any` 型の使用は原則禁止。やむを得ない場合はコメントで理由を明記する
- インデントは **4スペース**（Tab/Indent共に4）
- ファイル末尾には空行を1行入れる

### 命名規則

- **コンポーネント:** PascalCase（例: `VideoDetailScreen`, `TagSelector`）
- **関数・変数:** camelCase（例: `getSkiResortName`, `videoMetadata`）
- **定数:** UPPER_SNAKE_CASE（例: `MAX_THUMBNAIL_SIZE`, `DEFAULT_SEARCH_RADIUS`）
- **ファイル名:** コンポーネントは PascalCase、ユーティリティは camelCase
- **型定義:** PascalCase + 接尾辞なし（例: `Video`, `SkiResort`, `Tag`）

### ディレクトリ構成

```
src/
├── app/               # Expo Router 画面（ファイル = ルート）
│   ├── _layout.tsx    # ルートレイアウト（DB マイグレーション実行）
│   ├── (tabs)/        # NativeTabs タブ画面群（フォルダベースルーティング）
│   │   ├── _layout.tsx        # NativeTabs 定義（Liquid Glass 自動適用）
│   │   ├── index/_layout.tsx  # ホームタブ Stack ヘッダー
│   │   ├── calendar/_layout.tsx
│   │   ├── search/_layout.tsx
│   │   └── settings/_layout.tsx
│   ├── settings/      # 設定サブ画面（favorite-resorts, techniques, tags）
│   ├── video-import.tsx
│   └── video/[id].tsx
├── components/        # 再利用可能な UI コンポーネント
├── database/          # Drizzle スキーマ・DB インスタンス・リポジトリ
├── services/          # ビジネスロジック（インポート・サムネイル・エクスポート等）
├── hooks/             # カスタムフック
├── types/             # 型定義
├── constants/         # スキー場マスターデータ（JSON）・滑走種別プリセット
└── utils/             # ユーティリティ関数（日付処理・GPS距離計算）
drizzle/               # Drizzle 自動生成マイグレーション（手動編集禁止）
```

### コメント

- 日本語でコメントを書く（コード中のコメント・JSDoc共に）
- 「なぜ」を説明するコメントを重視し、「何をしているか」は明白なら省略する
- TODO/FIXME/HACK は積極的に残す

---

## Commit Message Rules

### Format

```
[emoji] English commit message
```

### Emoji Guidelines

[gitmoji.dev](https://gitmoji.dev) に準拠する。

- ✨ (`:sparkles:`) — New feature
- 🐛 (`:bug:`) — Bug fix
- 📝 (`:memo:`) — Documentation
- 🎨 (`:art:`) — Code style/formatting
- ♻️ (`:recycle:`) — Refactoring
- 🔧 (`:wrench:`) — Configuration
- 🚀 (`:rocket:`) — Performance improvement
- 🥅 (`:goal_net:`) — Error handling
- ✅ (`:white_check_mark:`) — Tests
- 🗃️ (`:card_file_box:`) — Database related
- 📱 (`:iphone:`) — Responsive design / mobile
- 🔍 (`:mag:`) — Search related

### Examples

```
[✨] Add video import with automatic EXIF metadata extraction
[✨] Implement GPS-to-ski-resort name resolution
[🗃️] Define SQLite schema for videos, tags, and memos
[🐛] Fix thumbnail generation failing for long videos
[♻️] Extract ski resort matching logic into dedicated service
[📝] Update README with project setup instructions
[🔧] Configure expo-media-library permissions for iOS
```

### When to provide commit messages

- 重要な新機能の実装後
- 大規模なリファクタリングや改善後
- バージョンリリース前
- ユーザーが明示的に要求した場合

---

## IMPORTANT: Git Operations Policy

**ユーザーの明示的な要求なしに、自動で stage / commit / push を実行しないこと。**

- 適切なタイミングでコミットメッセージを提案する
- `git add`, `git commit`, `git push` はユーザーが手動で行う
- コミットメッセージの提案を求められた場合は提案するが、gitコマンドは実行しない
- gitコマンドの実行はユーザーが明示的に要求した場合のみ

---

## Domain Knowledge

### スキー用語（タグや UI で使用）

- **大回り** — ロングターン
- **小回り** — ショートターン
- **コブ** — モーグルバーン
- **フリー** — フリーラン
- **パウダー** — 新雪・深雪
- **ポジション** — 身体の重心位置
- **後傾** — 重心が後ろに寄っている状態

### ファイル管理の設計意図

動画ファイルのコピーを作成しない「参照方式」を採用している。この設計判断は以下に基づく:

1. スキー動画は1本あたり数百MBになり、コピーは現実的でない
2. アプリの価値はメタデータ（タグ・メモ）にあり、動画本体にはない
3. 元動画が削除された場合はサムネイル + メタデータを保持し、UIで通知する

この方針に反するコード（動画ファイルのコピーや重複保存）を書かないよう注意すること。

---

## Development Commands

```bash
npm start              # Expo 開発サーバー起動
npm run ios            # iOS シミュレータ起動
npm run web            # Web ブラウザで起動（スタブ動作確認用）
npm run lint           # ESLint 実行
npm run db:generate    # Drizzle マイグレーション生成（schema.ts 変更後に必須）
npm run db:studio      # Drizzle Studio 起動（DB 内容確認）
```

**Expo Go は非対応。** `expo-sqlite` + Drizzle ORM は Expo Go で動作しない。実機テストには EAS Development Build が必須。

```bash
eas build --platform ios --profile development  # Development Build 作成
```

---

## Architecture Notes

### DB 初期化フロー

`src/app/_layout.tsx` が起動時に `useMigrations(db, migrations)` を呼び出し、自動マイグレーションを実行する。`migrations` は `drizzle/migrations.js`（自動生成）から import。**手動編集禁止。** スキーマ変更後は必ず `npm run db:generate` を実行する。

### DB アクセス層

- `src/database/schema.ts` — テーブル定義と Drizzle の infer 型
- `src/database/index.ts` — `db` シングルトンを export（アプリ全体で共有）
- `src/database/repositories/` — テーブルごとの CRUD。ビジネスロジックは含まない

#### テーブル構造

**videos** — 動画メタデータ（ファイル本体は保持しない）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | text PK | UUID |
| `assetId` | text unique | システムフォトライブラリの参照ID（重複インポート防止） |
| `filename` | text | 元ファイル名 |
| `thumbnailUri` | text | DocumentDirectory 内のサムネイルパス |
| `duration` | int | 秒数 |
| `capturedAt` | int | Unix タイムスタンプ（秒） |
| `skiResortName` | text nullable | スキー場名 |
| `memo` | text | ユーザーメモ |
| `title` | text nullable | ユーザーが設定した任意のタイトル（null → filename にフォールバック） |
| `techniques` | text nullable | 滑走種別プリセット選択状態（JSON配列文字列 e.g. `'["大回り","コブ"]'`） |
| `isFileAvailable` | int | 1=ファイル存在, 0=削除済み |
| `createdAt` | int | 作成日時 Unix タイムスタンプ |
| `updatedAt` | int | 更新日時 Unix タイムスタンプ |

**tags** — タグマスター。`type` は `"technique"` / `"skier"` / `"custom"` の3種

**video_tags** — 多対多の中間テーブル。`videoId` 削除時にカスケード削除

**technique_options** — 滑走種別オプションマスター。ユーザーが自由に追加・削除可能（`name` + `sortOrder`）

**favorite_resorts** — お気に入りスキー場テーブル。素早い選択用の名前一覧

#### タグタイプ

| type | 用途 |
|------|------|
| `technique` | 滑走技術プリセット（大回り・小回り・コブ等）。`src/constants/techniques.ts` に定義済み |
| `skier` | 動画に映っている人物名 |
| `custom` | ユーザーが自由に作成するタグ |

### サービス層

リポジトリを組み合わせてユースケースを実現する。

| ファイル | 役割 |
|----------|------|
| `importService.ts` | インポートのオーケストレーター（メタデータ取得 → サムネイル生成 → DB 保存 → タグ紐付け） |
| `mediaService.ts` | `expo-media-library` ラッパー |
| `thumbnailService.ts` | サムネイルを生成し `DocumentDirectory` に保存 |
| `exportService.ts` | メタデータを JSON にシリアライズして `expo-sharing` で共有 |

### ユーティリティ

| ファイル | 役割 |
|----------|------|
| `utils/geoUtils.ts` | Haversine 公式による GPS 距離計算 + 最寄りスキー場マッチング |
| `utils/dateUtils.ts` | 日付操作ヘルパー（月初末計算、dateKey 変換等） |

### カスタムフック

画面コンポーネントはこれらのフックを通じてデータにアクセスする。

| フック | ファイル | 役割 |
|--------|----------|------|
| `useVideos` | `hooks/useVideos.ts` | 動画一覧取得・フィルタリング。`useFocusEffect` で画面フォーカス時に自動再取得 |
| `useVideoDetail` | `hooks/useVideoDetail.ts` | 単一動画の取得・メモ更新・スキー場更新・タグ置換・削除・ファイル存在確認 |
| `useCalendar` | `hooks/useCalendar.ts` | カレンダー画面の月ナビゲーション・ドットマーカー・日付選択 |
| `useTheme` | `hooks/use-theme.ts` | デバイスのカラースキームに応じたテーマカラーを返す |

### 主要型定義（`src/types/index.ts`）

```ts
Video             // DB レコード（title, techniques, createdAt, updatedAt を含む）
VideoWithTags     // Video + tags: Tag[]（画面表示で主に使用）
Tag               // { id, name, type: TagType }
TagType           // "technique" | "skier" | "custom"
SkiResort         // { id, name, prefecture, latitude?, longitude? }
FilterOptions     // { skiResortName?, tagIds?, dateFrom?, dateTo?, searchText? }
ImportMetadata    // { title, skiResortName, memo, tagIds, techniques }
```

### Web スタブパターン

ネイティブ依存モジュールは Web では動作しないため、`.web.ts` / `.web.tsx` ファイルをペアで管理する。Metro がプラットフォーム拡張子に応じて自動選択する。

スタブが必要な層:
- **`database/repositories/`** — Drizzle + expo-sqlite 依存（`videoRepository`, `tagRepository`, `techniqueOptionRepository`）
- **`services/`** — expo-media-library / expo-video-thumbnails 等のネイティブ API 依存（全4サービス）
- **`hooks/`** — `use-color-scheme`（Appearance API）
- **`components/`** — `animated-icon`（ネイティブアニメーション）
- **`app/`** — `_layout`, `video-import`, `video/[id]`（DB 初期化・ネイティブ機能依存画面）

新しいネイティブ依存モジュールを追加する際は、対応する `.web.ts` スタブも必ず作成すること。

### タブナビゲーション（NativeTabs）

`expo-router/unstable-native-tabs` の `NativeTabs` を使用。iOS 26+ で Liquid Glass タブバーが自動適用され、iOS 25 以前は標準ネイティブタブにフォールバックする。

NativeTabs はヘッダーを内蔵しないため、各タブはフォルダベースルーティング（`(tabs)/index/`, `(tabs)/calendar/` 等）を採用し、フォルダ内の `_layout.tsx` に Stack を配置してヘッダーを管理する。

ヘッダースタイル統一: `backgroundColor: "#1A3A5C"`, `headerTintColor: "#FFFFFF"`, `headerTitleStyle: { fontWeight: "700" }`

### Expo 実験的機能

`app.json` の `experiments` で以下が有効:
- `typedRoutes: true` — 型安全ルーティング（`router.push()` の引数を型チェック）
- `reactCompiler: true` — React Compiler（自動メモ化）

### ビルド設定（Metro / Babel）

- **Metro:** `.sql` を `sourceExts` に追加（Drizzle マイグレーションファイル用）。Web ビルドでは `expo-sqlite` / `drizzle-orm/expo-sqlite` を空モジュール（`src/mocks/emptyModule.js`）にリダイレクト
- **Babel:** `inline-import` プラグインで `.sql` ファイルをインライン化。`react-native-reanimated/plugin` を使用

### GPS ベースのスキー場サジェスト

動画の EXIF GPS 座標から最寄りのスキー場を自動サジェストする。`src/utils/geoUtils.ts` が Haversine 公式で距離を計算し、`src/constants/skiResorts.json` のマスターデータ（latitude/longitude 付き）とマッチングする。

### パスエイリアス

`@/*` → `src/*`、`@/assets/*` → `assets/*`（`tsconfig.json` で設定済み）

```ts
import { db } from "@/database";     // src/database/index.ts
import type { Video } from "@/types"; // src/types/index.ts
```

### postinstall パッチ

`scripts/patchImageUtilsCache.js` が `postinstall` と `eas-build-post-install` で実行される。expo-image のキャッシュ問題を回避するパッチ。
