# SnowLog

スキーヤー向け動画管理・振り返りアプリ。

「撮って渡す」の先を担うアプリ。ゲレンデでの即時共有は AirDrop に任せ、アプリは **整理・振り返り** に特化する。

## Features

- **動画インポート** — フォトライブラリから動画を選択し、メタデータとともに管理
- **サムネイル生成** — 動画先頭フレームを自動生成して保存
- **タグ付け** — 技術タグ（大回り・小回り・コブ等）、スキーヤータグ、カスタムタグを動画に紐付け
- **スキー場検索** — 全国230件超のスキー場マスターデータからインクリメンタル検索
- **メモ** — 各動画に自由記述のメモを残せる
- **フィルター検索** — スキー場名・タグ・日付範囲・テキストで動画を絞り込み
- **エクスポート** — メタデータ＋メモを JSON 形式でエクスポートしてシステム共有

## Design Principles

- **参照方式** — 動画ファイルのコピーは作成しない。メタデータとサムネイルのみ保持し、フォトライブラリの元ファイルを参照する
- **完全ローカル** — クラウド連携なし。データはデバイス内のみに保存
- **iOS 専用** — Android 非対応

## Tech Stack

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Expo SDK 55 |
| 言語 | TypeScript (strict) |
| ルーティング | Expo Router v4 (file-based) |
| DB | expo-sqlite v15 + Drizzle ORM |
| 動画アクセス | expo-media-library |
| 動画インポート | expo-image-picker |
| 動画再生 | expo-video |
| サムネイル | expo-video-thumbnails |
| ファイル保存 | expo-file-system |
| エクスポート共有 | expo-sharing |
| ID生成 | expo-crypto |

## Project Structure

```
SnowLog/
├── src/
│   ├── app/                      # Expo Router 画面
│   │   ├── _layout.tsx           # ルートレイアウト（DB初期化）
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx       # タブバー定義
│   │   │   ├── index.tsx         # ホーム（動画一覧）
│   │   │   └── search.tsx        # 検索・フィルタ
│   │   ├── video-import.tsx      # インポートモーダル
│   │   └── video/[id].tsx        # 動画詳細
│   ├── components/               # UIコンポーネント
│   │   ├── VideoCard.tsx
│   │   ├── TagChip.tsx
│   │   ├── TagSelector.tsx
│   │   ├── SkiResortSearch.tsx
│   │   └── FilterBar.tsx
│   ├── database/
│   │   ├── index.ts              # DB インスタンス
│   │   ├── schema.ts             # Drizzle スキーマ
│   │   └── repositories/
│   │       ├── videoRepository.ts
│   │       └── tagRepository.ts
│   ├── services/
│   │   ├── mediaService.ts       # expo-media-library ラッパー
│   │   ├── thumbnailService.ts   # サムネイル生成・保存
│   │   ├── importService.ts      # インポートフロー
│   │   └── exportService.ts      # JSON エクスポート
│   ├── hooks/
│   │   ├── useVideos.ts
│   │   └── useVideoDetail.ts
│   ├── constants/
│   │   ├── skiResorts.json       # 全国スキー場マスターデータ（230件）
│   │   └── techniques.ts         # 滑走種別プリセット
│   ├── types/index.ts
│   └── utils/dateUtils.ts
├── drizzle/                      # Drizzle 生成マイグレーションファイル
├── babel.config.js
├── metro.config.js
├── drizzle.config.ts
└── app.json
```

## Database Schema

```
videos          動画レコード（メタデータ + サムネイルパス）
tags            タグマスター（technique / skier / custom）
video_tags      動画↔タグ 中間テーブル
```

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Apple Developer Program アカウント（実機テスト用）

> **注意:** `expo-sqlite` + Drizzle ORM は Expo Go 非対応です。Development Build が必須です。

### Install

```bash
npm install
```

### Generate DB migrations

```bash
npm run db:generate
```

### Build (EAS)

```bash
# EAS にログイン
eas login

# iOS Development Build を作成
eas build --platform ios --profile development
```

ビルド後、生成された `.ipa` を iPhone にインストールし、以下で開発サーバーを起動します：

```bash
npx expo start
```

## Scripts

| コマンド | 内容 |
|---------|------|
| `npm start` | Expo 開発サーバー起動 |
| `npm run ios` | iOS シミュレータ起動（Mac 必須） |
| `npm run lint` | ESLint 実行 |
| `npm run db:generate` | Drizzle マイグレーションファイル生成 |
| `npm run db:studio` | Drizzle Studio 起動 |
