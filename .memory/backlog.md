---
title: バックログ
updated: 2026-07-15
status: active
---

# バックログ

コードや git log からは読み取れない「これからやりたいこと」の置き場。

**大原則: GitHub Issues が正。** SnowLog は Issue 運用がしっかりしており（2026-07-15 時点で全 69 件 / open 12）、
やることは基本すべて Issue 化されている。ここに同じ内容を書くと二重管理になり、必ず片方が腐る。
このファイルには **Issue になっていないものだけ** を置く。Issue 化できたらここから消す。

## Issue 化されていない項目

- **`src/app/video-import.tsx` の分割** — 約 1,333 行で、規約の ~500〜700 行を大きく超過。アプリの中核機能なので分割は慎重に。

## 既に Issue がある主要テーマ（重複して書かないこと）

作業前にこの対応表を見て、既存 Issue を確認する。

| テーマ | Issue |
| --- | --- |
| ドキュメントの i18n 記述が古い | [#56](https://github.com/kmch4n/SnowLog/issues/56) |
| orphanedFileCleanupService のドキュメント未記載 | [#57](https://github.com/kmch4n/SnowLog/issues/57) |
| i18n の不活性な購読配線と残存 `locale` 行の削除 | [#64](https://github.com/kmch4n/SnowLog/issues/64) |
| 未使用の Expo テンプレート由来ファイル・`theme.ts` の削除 | [#65](https://github.com/kmch4n/SnowLog/issues/65) |
| ユーティリティ関数の自動テスト基盤 | [#38](https://github.com/kmch4n/SnowLog/issues/38) |
| Error Boundary の追加 | [#37](https://github.com/kmch4n/SnowLog/issues/37) |
| タグ取得の N+1 解消 | [#66](https://github.com/kmch4n/SnowLog/issues/66) |

## 完了済み（2026-03-26 に挙がっていた 3 件）

再提案を防ぐため記録を残す。いずれも実装済み。

| 項目 | 実装先 |
| --- | --- |
| 撮影地からスキー場をサジェスト | `src/utils/geoUtils.ts`（GPS → Haversine 最近傍）、`src/hooks/useSkiResortSuggestions.ts`、`src/constants/skiResorts.json`（378 件・座標入り）。Issue [#68](https://github.com/kmch4n/SnowLog/issues/68) / コミット `a0bfd29`・`0305ba4` |
| 動画詳細の拡充表示（時刻・解像度・秒数） | `src/app/video/[id].tsx` — `mediaService` の `getAssetInfoAsync` から `width` / `height` / `duration` を取得して表示 |
| 写真アプリで開くボタン | `src/app/video/[id].tsx` — `Linking.openURL("photos-redirect://")` |
