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

**アップグレード利用者への影響:** 言語ピッカーがあった頃のユーザーの `app_preferences` テーブルには、未使用の `locale` 行が残っている可能性がある。実害は無いがクリーンアップ候補。

## 2. `orphanedFileCleanupService` がドキュメントに存在しない

`src/services/orphanedFileCleanupService.ts` と、設定画面の「不要ファイルを削除」行、起動時のクリーンアップ処理が
`SnowLog.md`（§5 起動処理 / §7.7 設定メニュー / §9.3 サービス表 / §10 メディア保存ポリシー）に記載されていない。
`SnowLog.md §7.7` は削除済みの「言語設定」を含む 6 項目のままだが、実際は 5 つの遷移行 + 保守行 1 つ。
詳細と修正範囲は Issue [#57](https://github.com/kmch4n/SnowLog/issues/57) にまとまっている。

## 3. ファイルサイズ規約の逸脱

`.claude/CLAUDE.md` と `.codex/AGENTS.md` はファイルを ~500〜700 行に収めるよう定めているが、`src/app/video-import.tsx` は約 1,333 行あり大きく超えている。規約違反として認識されており、分割候補。
