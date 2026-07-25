---
title: ドキュメントとコードの乖離
updated: 2026-07-15
status: active
---

# ドキュメントとコードの乖離

既存ドキュメントのうち、**現在のコードと食い違っている記述**の一覧。ドキュメントを鵜呑みにして実装すると壊れる箇所なので、着手前に確認する。
修正できたタイミングで、該当項目をこのファイルから消すこと。

修正作業そのものは Issue [#56](https://github.com/kmch4n/SnowLog/issues/56)（i18n 記述）と
[#57](https://github.com/kmch4n/SnowLog/issues/57)（orphanedFileCleanupService 未記載）で管理されている。
このファイルは「Issue を読む前に踏み抜かないための警告」であり、作業管理は Issue が正。

## 1. i18n の言語切替 —『手動切替できる』は誤り

**古い記述:**

- `README.md` —「設定画面からの手動切替（日本語 / English / デバイスに従う）に対応し、選択は端末ローカルに永続化する」
- `SnowLog.md` — 「5.4 i18n 初期ロケール解決」節および「言語設定」節。`getPreference("locale")` で永続化設定を取得する、3 択で即時反映する、など。

**実態:**

言語ピッカーはコミット `bab0b45` で削除済み。現在の `src/i18n/index.ts` は `expo-localization` の `getLocales()[0]?.languageCode` を**モジュール初期化時に一度だけ読み**、`ja` 以外を `en` に正規化して `i18n-js` に固定する。切替 API も永続化も存在しない。ユーザーは iOS のシステム言語を変えることでしか言語を変更できない。

`useTranslation()` が返すのは `{ t, locale }` のみで、setter は無い。

**補足:** `src/i18n/index.ts` の `listeners` / `version` / `subscribeToLocale`（`useSyncExternalStore` 用の配線）は完全に不活性。誰も発火させないので `version` は常に 0。削除候補。

**正しく書けている場所:** `.claude/CLAUDE.md` は「i18n is device-locale-only (no runtime switching)」と正確に記述している。仕様を確認するときはこちらを見る。

**アップグレード利用者への影響:** 言語ピッカーがあった頃のユーザーの `app_preferences` テーブルには、未使用の `app_locale` 行（旧 `src/i18n/types.ts` の `LOCALE_PREFERENCE_KEY`）が残っている可能性がある。キー名は `locale` ではない。クリーンアップのマイグレーションは存在せず、`exportService.ts` が `getAllPreferences()` で全 preference を書き出すため、この残存行はバックアップ JSON にも混入する。
作業は Issue [#64](https://github.com/kmch4n/SnowLog/issues/64) で管理。同 Issue の修正案はかつて `key = 'locale'` を削除すると書いていたが（それでは 1 行も消えない）、2026-07-25 の Issue 監査で本文・受け入れ条件とも `app_locale` に修正済み。

## 2. `orphanedFileCleanupService` がドキュメントに存在しない

`src/services/orphanedFileCleanupService.ts` と、設定画面の「不要ファイルを削除」行、起動時のクリーンアップ処理が
`SnowLog.md`（§5 起動処理 / §7.7 設定メニュー / §9.3 サービス表 / §10 メディア保存ポリシー）に記載されていない。
`SnowLog.md §7.7` は削除済みの「言語設定」を含む 6 項目のままだが、実際は 5 つの遷移行 + 保守行 1 つ。
詳細と修正範囲は Issue [#57](https://github.com/kmch4n/SnowLog/issues/57) にまとまっている。

## 3. エクスポートが iOS から到達不能 —『設定からエクスポートできる』は誤り

**古い記述:** `pr/web` の FAQ が「アプリ内設定から JSON でエクスポートし、新しい端末で読み込む」と案内していた（2026-07-17 に修正済み）。
`src/i18n/locales/{ja,en}.ts` には `settings.menu.export`（「ライブラリ全体を JSON でエクスポートします」）と `settings.export.*` ブロックが残っている。

**実態:**

- `exportAllToJSON()`（`src/services/exportService.ts:21`）の呼び出し元は **`src/app/video/[id].web.tsx` のみ** — Web 検証スタブのヘッダーボタンで、iOS からは到達できない。
- 設定画面（`src/app/(tabs)/settings/index.tsx`）の `SettingsRoute` は calendar / techniques / favorite-resorts / tags / duplicate-candidates の 5 つ + ストレージ整理行のみで、エクスポート行は無い。
- 死んでいる i18n 文言は `settings.menu.export`（ja.ts:164）と `settings.descriptions.export`（ja.ts:173）の 2 つ。`settings.export.*` ブロックは web 経路（`video/[id].web.tsx`）と `exportService` 自身から参照されており生きている（未参照は `title` / `description` / `buttonLabel` / `success` のみ）。
- なお `video/[id].web.tsx` の import は web では `exportService.web.ts`（未対応 Alert）に解決されるため、ネイティブ実装の `exportAllToJSON()` は**どのプラットフォームからも到達不能**。
- **インポート（JSON 復元）は未実装**。`readAsStringAsync` / `DocumentPicker` / `getDocumentAsync` / `importFromJSON` は全て 0 ヒットで、`expo-document-picker` の依存も無い。`src/services/importService.ts` は名前に反して写真ライブラリからの動画取り込み。

結果として、現状の実装では機種変更時のデータ移行ができない。エクスポートは将来実装予定。
作業は Issue [#72](https://github.com/kmch4n/SnowLog/issues/72) で管理。

## 4. `NSPhotoLibraryAddUsageDescription` の説明文が実態と一致しない

`app.json`（および `locales/ja.json` / `locales/en.json`）の `NSPhotoLibraryAddUsageDescription` は
「サムネイル画像の保存のため、フォトライブラリへの書き込みが必要です。」と述べているが、
**サムネイルは写真ライブラリではなく `documentDirectory/thumbnails/` に保存される**（`src/services/thumbnailService.ts:17-18`）。

実際には `MediaLibrary.createAssetAsync` / `saveToLibraryAsync` / `addAssetsToAlbumAsync` は src 全体で 0 ヒットで、
写真ライブラリへの書き込み経路は存在しない（`mediaService.ts` が使うのは読み取り系のみ）。
App Store 審査で実態と乖離した権限説明になるため、文言修正または権限自体の削除を検討する。
作業は Issue [#73](https://github.com/kmch4n/SnowLog/issues/73) で管理。

## 5. `schema.ts` のコメント『動画ファイルのコピーは保持しない（参照方式）』は不正確

`src/database/schema.ts:5` のコメントに反して、`managedVideoFileService.persistManagedVideoFile()`
（`src/services/managedVideoFileService.ts:39-58`）が `${FileSystem.documentDirectory}videos/` へ動画本体を `copyAsync` する。

発動条件は `isSyntheticAssetId(asset.id)`（assetId が `"synthetic:"` 始まり = 写真ライブラリのアセットとして扱えない動画）の場合のみで、
`src/services/importService.ts:56-58` が唯一の呼び出し箇所。通常の写真ライブラリ動画は参照のみで正しい。
コピーは動画削除時（`videoDeletionService.ts:27-28`）とアンインストール時に消える。

## 6. ファイルサイズ規約の逸脱

`.claude/CLAUDE.md` と `.codex/AGENTS.md` はファイルを ~500〜700 行に収めるよう定めているが、`src/app/video-import.tsx` は約 1,333 行あり大きく超えている。規約違反として認識されており、分割候補。
