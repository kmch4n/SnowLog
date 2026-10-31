---
title: 非自明な配線とデータ契約
updated: 2026-10-26
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
| バージョン | `package.json` が正（2026-10-26 時点で 1.4.0。App Store の最新リリースは v1.3.0） |
| スタック | Expo SDK 55 / RN 0.83.6 / React 19.2 / Expo Router v4（NativeTabs, Liquid Glass）/ expo-sqlite + Drizzle / i18n-js v4 + expo-localization |
| ターゲット | iOS が主。Android / Web は検証用スタブ。**EAS Dev Build 必須 — SDK 55 は Expo Go 非対応** |
| 画面 | ホーム（一覧 + お気に入り）、統計、カレンダー（月/週）、検索、設定（滑走種別 / タグ / お気に入りスキー場 / カレンダー / 重複候補 + 不要ファイル削除の保守行）、インポートモーダル、動画詳細、日記 |

技術選定の理由は `docs/design-notes.md`、実装仕様は `SnowLog.md` にある。

## ディレクトリで注意すべき点

構成そのものは `AGENTS.md` にある。ここは非自明な点だけ。

- `src/constants/colors.ts` — **`Colors` の定義場所はここ一箇所だけ。** 他に増やさない。
- `drizzle/` — 生成物。**手で編集しない。** `npm run db:generate` で再生成する。
- `locales/ja.json` / `locales/en.json`（リポジトリ直下） — iOS の権限説明文。`src/i18n/locales/` とは別物。
- `pr/web/` — Astro 製ランディングページ。独立した `node_modules` を持つ別プロジェクト。
- `pr/pv/` — Remotion 製の紹介映像。同じく独立プロジェクト。`public/` は生成物で git 管理外。
- **Web シム**: ネイティブ依存モジュール（repositories / services / ネイティブ専用画面）には `.web.ts` / `.web.tsx` の相方が必要。相方が無いモジュールを Web から到達可能なパスで import しないこと。欠落は `tsc` では検出できず、`webShimParity` と `webEmptyModules` の 2 つのテストが強制する（下の「Web の配線」参照）。

---

## 起動順序（`src/app/_layout.tsx`）

**順序に依存関係があるので、確認せずに並べ替えないこと。**

1. Drizzle の `useMigrations` が最初に走る。
2. 成功後、差分方式の `seedTechniqueOptions` と、不要になった `app_locale` 設定の一度限りの削除。
3. サムネイル URI の移行（`app_preferences.thumbnail_migration_version` で制御）。実行中はブロッキングで `ThumbnailMigrationScreen` を描画する。
4. サムネイル段階が `done` に解決した後、`InteractionManager.runAfterInteractions` が 3 つのバックグラウンドジョブを起動する — `repairInvalidCapturedAt` / `cleanupOrphanedFiles` / `getOptionalUpdateInfo`（`updateCheckService`。App Store Lookup API を叩き、任意アップデートの `Alert` を出しうる）。

Stack（`GestureHandlerRootView` + `ThemeProvider` でラップ）は上記と並行して描画される。
ロケールは `src/i18n/index.ts` のモジュール初期化時に一度だけ解決され、以後読み直されない。

## Web の配線（2026-10-26。Issue #84 で判明）

Web は `npm run web` で起動するプレビュー。動かすうえで踏んだ罠が 5 つある。

1. **Expo Router は描画しないレイアウトも評価する。** `getRoutesCore.js` の `getLayoutNode()` が
   `unstable_settings` を読むために全 `_layout` の `loadRoute()` を呼ぶので、Web でもネイティブの
   `_layout.tsx` が import される（描画されるのは `_layout.web.tsx`）。その import 先がモジュール評価時に
   native API を呼ぶと Web は起動前に落ちる。`metro.config.js` は Web で `expo-sqlite` と
   `drizzle-orm/expo-sqlite*` を空モジュールに差し替えているので、`src/database/index.ts` の
   `openDatabaseSync()` がまさにそれだった。→ `src/database/index.web.ts` を置いた。
   `scripts/tests/webEmptyModules.test.cjs` が「空モジュール化されるパッケージを import するファイルには
   `.web` の相方が要る」を強制する。**ネイティブの `_layout.tsx` は評価だけされて描画されないので、
   その hooks や起動処理が Web で走ることはない。**
2. **react-native-web の `Alert.alert` は空実装。** 何も表示されず、確認待ちの削除などが実行できない。
   `_layout.web.tsx` が `installWebAlert()` で `components/WebAlertHost.tsx`（待ち行列は
   `utils/webAlertQueue.ts`）に差し替える。ネイティブには影響しない。
3. **Web のデータは `src/mocks/webMockStore.ts` の 1 つのインメモリストア。** `*.web.ts` リポジトリは
   ネイティブと同じ行の形を返すこと。特に `videos.techniques` は JSON 文字列（フックが文字列として
   `parseTechniques` する）。配列で返すと滑走種別が常に空になる。

4. **Web 版 react-native-gesture-handler は、ジェスチャーが動いても下の Touchable を取り消さない。**
   react-native-web の `onPress` はブラウザの click で発火するので、マウスでカードをスワイプして離すと
   詳細画面が開いていた。`utils/webDragClickGuard.ts` が「マウス・ペンで 10px 以上動いた後の click」を捨てる
   （タッチはブラウザ自身が click を出さない）。
5. **Web 版の NativeViewGestureHandler は `scrollEnabled` を見ずに 10px で activate する。** リストの
   ScrollView を包むこのハンドラが DraggableFlatList の Pan を失敗させ、種別の並べ替えが追従しなかった。
   `settings/techniques.tsx` が Web でだけ `enabled={false}` を渡し、ハンドルに `touch-action: none` を付ける。
   **新しく RNGH のジェスチャーをリスト内に置くときは同じ罠を踏む。**

検証は `npm run test:web`（全ルートを headless Chrome で描画）。ジェスチャーは自動検証が無いので、
触ったらブラウザでマウスとタッチの両方を試すこと。

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

- `videos.techniques` は JSON 文字列。`parseTechniques` でパースする。
- `videos.storage_mode` が保存方式（`reference` / `copy`）、`videos.managed_video_path` が `copy` の実体の相対パス。
  絶対 URI を保存してはいけない（iOS がコンテナを再配置する）。解決は `managedVideoFileService.managedPathToUri`。
  **起動順の制約**: `storageMigrationService.migrateVideoStorage()` が commit するまで、サムネイル修復・
  孤児ファイル掃除・撮影日修復を走らせない。掃除は `managed_video_path` で所有を判定するため、
  バックフィル前に走ると管理コピーを孤児と誤認する（`_layout.tsx` のバリア）。
- `tags(name, type)` が一意（migration `0007`）。`tag.type` ∈ `"technique" | "skier" | "custom"`。
- `favorite_resorts.name` が一意。`diary_entries.dateKey`（YYYY-MM-DD）が一意 — 1 日 1 エントリ。
- `app_preferences` は key-value ストア。**現在実際に使われているキー**: `capturedAt_repair_version` / `thumbnail_migration_version` / `home_sort_order` / `weekStartDay` / `dismissed_update_prompt_version`。
    - `weekStartDay` だけが camelCase。**歴史的な事故によるもので、データマイグレーションなしに snake_case へ変えてはいけない。**
    - 言語ピッカー削除（`bab0b45`）が残した `app_locale` 行は、起動時に `seedTechniqueOptions` の隣で削除される。キー名は `app_locale` であって `locale` ではない。
    - **`exportService` は全設定を verbatim でダンプする**ので、ここにキーを増やすとバックアップ JSON にもそのまま載る。
    - **エクスポートは全部出すが、インポートは 2 つしか戻さない。** 復元対象は
      `home_sort_order` と `weekStartDay` だけで、許可リストは
      `src/services/importPayload.ts` の `RESTORABLE_PREFERENCE_KEYS`。
      `thumbnail_migration_version` / `capturedAt_repair_version` を書き戻すと、
      新規インストールで当該マイグレーションが「済み」と判定されて飛ぶ。
      **キーを増やしたときは、復元してよいものかをここで判断すること。**
