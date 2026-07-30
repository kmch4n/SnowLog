---
title: 非自明な配線とデータ契約
updated: 2026-07-30
status: active
---

# 非自明な配線とデータ契約

コードを読んでも気づきにくい起動順序・暗黙の前提・データ上の約束をまとめる。
**踏むと壊れる順序依存が中心なので、該当箇所を触る前に読むこと。**

2026-07-30 に `.claude/CLAUDE.md` から移設した。移設の理由は、CLAUDE.md が毎セッション必ず
コンテキストに載る一方、この内容は該当箇所を触るときだけ必要だからである。常時読み込みの
ファイルに置くと、使わないターンでもトークンを消費し続ける。

---

## プロダクトの現況

| 項目 | 内容 |
| --- | --- |
| アプリ | SnowLog — オフラインファーストの滑走動画ログ + 日記 |
| バージョン | 1.2.0（App Store 公開中） |
| スタック | Expo SDK 55 / RN 0.83.6 / React 19.2 / Expo Router v4（NativeTabs, Liquid Glass）/ expo-sqlite + Drizzle / i18n-js v4 + expo-localization |
| ターゲット | iOS が主。Android / Web は検証用スタブ。**EAS Dev Build 必須 — SDK 55 は Expo Go 非対応** |
| 画面 | ホーム（一覧 + お気に入り）、統計、カレンダー（月/週）、検索、設定（滑走種別 / タグ / お気に入りスキー場 / カレンダー / 重複候補 + 不要ファイル削除の保守行）、インポートモーダル、動画詳細、日記 |

技術選定の理由は `docs/design-notes.md`、実装仕様は `SnowLog.md` にある。

## ディレクトリで注意すべき点

構成そのものは `.codex/AGENTS.md` にある。ここは非自明な点だけ。

- `src/constants/colors.ts` — **`Colors` の定義場所はここ一箇所だけ。** 他に増やさない。
- `drizzle/` — 生成物。**手で編集しない。** `npm run db:generate` で再生成する。
- `locales/ja.json` / `locales/en.json`（リポジトリ直下） — iOS の権限説明文。`src/i18n/locales/` とは別物。
- `pr/web/` — Astro 製ランディングページ。独立した `node_modules` を持つ別プロジェクト。
- `pr/pv/` — Remotion 製の紹介映像。同じく独立プロジェクト。`public/` は生成物で git 管理外。
- **Web シム**: ネイティブ依存モジュール（repositories / services / ネイティブ専用画面）には `.web.ts` / `.web.tsx` の相方が必要。相方が無いモジュールを Web から到達可能なパスで import しないこと。欠落は `tsc` では検出できない（[doc-drift.md](doc-drift.md) 参照）。

---

## 起動順序（`src/app/_layout.tsx`）

**順序に依存関係があるので、確認せずに並べ替えないこと。**

1. Drizzle の `useMigrations` が最初に走る。
2. 成功後、差分方式の `seedTechniqueOptions` と、不要になった `app_locale` 設定の一度限りの削除。
3. サムネイル URI の移行（`app_preferences.thumbnail_migration_version` で制御）。実行中はブロッキングで `ThumbnailMigrationScreen` を描画する。
4. サムネイル段階が `done` に解決した後、`InteractionManager.runAfterInteractions` が 3 つのバックグラウンドジョブを起動する — `repairInvalidCapturedAt` / `cleanupOrphanedFiles` / `getOptionalUpdateInfo`（`updateCheckService`。App Store Lookup API を叩き、任意アップデートの `Alert` を出しうる）。

Stack（`GestureHandlerRootView` + `ThemeProvider` でラップ）は上記と並行して描画される。
ロケールは `src/i18n/index.ts` のモジュール初期化時に一度だけ解決され、以後読み直されない。

## その他の非自明な配線

- **一括インポート結果の受け渡し** — 完了時に `importService` が `bulkImportSummaryService.setPendingBulkImportSummary({success, skipped, error})` を呼ぶ。ホーム画面がフォーカス時に `consumePendingBulkImportSummary` で取り出してアラートを出す。**インポートモーダルから直接サマリを出さないこと。**
- **i18n は端末ロケール固定（実行時切替なし）** — `src/i18n/index.ts` がモジュール初期化時に `expo-localization.getLocales()[0]?.languageCode` を一度読み、`ja` 以外を `en` に正規化して `i18n-js` に固定する。`useTranslation()` が返すのは `{ t, locale }` だけで、設定 API もセッターも永続化キーも無い。アプリ内の言語ピッカーは `bab0b45` で削除済み。ユーザーは iOS の言語設定を変える（＝アプリが再起動する）ため、購読機構は一切持たない。`Translations = typeof ja` により `ja.ts` と `en.ts` の型パリティはコンパイル時に強制される。
- **ハプティクスは必ず `services/hapticsService.ts` 経由**（`hapticLight` / `Medium` / `Selection` / `Success` / `Warning` / `Error`）。`safeFire` ラッパが `expo-haptics` の `UnavailabilityError` を飲むので、古い dev client バイナリでも呼び出し側が落ちない。**他の場所から `expo-haptics` を直接 import しない**（`eslint.config.js` の `no-restricted-imports` で強制）。
- **サムネイルは `documentDirectory` 相対** — iOS のコンテナ移動で無効化されないようにするため。ファイル欠損は `THUMBNAIL_MISSING_SENTINEL` で印を付ける。**絶対 URI を永続化しないこと。**
- **SQLite** — `foreign_keys = ON` と WAL モードで開く。`setTagsForVideo` はトランザクション内で走るので、タグ更新が中途半端に漏れることはない。
- **iOS 権限文言のローカライズ** — リポジトリ直下の `locales/ja.json` と `locales/en.json` を編集する。`app.json` の `expo.locales` + `CFBundleLocalizations: ["ja","en"]` で配線される。`app.json` にインラインで書かれている `infoPlist.NSPhoto*UsageDescription` は**日本語フォールバック専用**で、実際のローカライズをこれに頼らないこと。
- **型付きルート / React Compiler** — `app.json` で `typedRoutes: true` と `reactCompiler: true`。新しいルートは生成された型を満たす必要がある。**キャストで迂回しないこと。**

---

## データ契約（`src/database/schema.ts` からの差分）

スキーマの正は `src/database/schema.ts`、テーブル一覧は `SnowLog.md` §6。ここは非自明な点だけ。

- `videos.techniques` は JSON 文字列。`parseTechniques` でパースする。動画ファイルは動かさない（参照方式）— `documentDirectory` に置くのはサムネイルと管理コピーのみ。
- `tags(name, type)` が一意（migration `0007`）。`tag.type` ∈ `"technique" | "skier" | "custom"`。
- `favorite_resorts.name` が一意。`diary_entries.dateKey`（YYYY-MM-DD）が一意 — 1 日 1 エントリ。
- `app_preferences` は key-value ストア。**現在実際に使われているキー**: `capturedAt_repair_version` / `thumbnail_migration_version` / `home_sort_order` / `weekStartDay` / `dismissed_update_prompt_version`。
    - `weekStartDay` だけが camelCase。**歴史的な事故によるもので、データマイグレーションなしに snake_case へ変えてはいけない。**
    - 言語ピッカー削除（`bab0b45`）が残した `app_locale` 行は、起動時に `seedTechniqueOptions` の隣で削除される。キー名は `app_locale` であって `locale` ではない。
    - **`exportService` は全設定を verbatim でダンプする**ので、ここにキーを増やすとバックアップ JSON にもそのまま載る。
