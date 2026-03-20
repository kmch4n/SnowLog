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
│   ├── (tabs)/        # タブ画面群
│   ├── video-import.tsx
│   └── video/[id].tsx
├── components/        # 再利用可能な UI コンポーネント
├── database/          # Drizzle スキーマ・DB インスタンス・リポジトリ
├── services/          # ビジネスロジック（インポート・サムネイル・エクスポート等）
├── hooks/             # カスタムフック
├── types/             # 型定義
├── constants/         # スキー場マスターデータ・滑走種別プリセット
└── utils/             # ユーティリティ関数
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

- `src/database/schema.ts` — テーブル定義（`videos`, `tags`, `video_tags`）と Drizzle の infer 型
- `src/database/index.ts` — `db` シングルトンを export（アプリ全体で共有）
- `src/database/repositories/` — テーブルごとの CRUD。ビジネスロジックは含まない

### サービス層

リポジトリを組み合わせてユースケースを実現する。

| ファイル | 役割 |
|----------|------|
| `importService.ts` | インポートのオーケストレーター（メタデータ取得 → サムネイル生成 → DB 保存 → タグ紐付け） |
| `mediaService.ts` | `expo-media-library` ラッパー |
| `thumbnailService.ts` | サムネイルを生成し `DocumentDirectory` に保存 |
| `exportService.ts` | メタデータを JSON にシリアライズして `expo-sharing` で共有 |

### Web スタブパターン

ネイティブ依存モジュールは Web では動作しないため、ファイルをペアで管理する。Metro がプラットフォームに応じて自動選択する。

```
mediaService.ts       # iOS 実装
mediaService.web.ts   # Web 用スタブ（空実装）
```

### パスエイリアス

`@/*` → `src/*`（`tsconfig.json` で設定済み）

```ts
import { db } from "@/database";     // src/database/index.ts
import type { Video } from "@/types"; // src/types/index.ts
```
