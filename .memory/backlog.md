---
title: バックログ
updated: 2026-08-31
status: active
---

# バックログ

コードや git log からは読み取れない「これからやりたいこと」の置き場。

**大原則: GitHub Issues が正。** SnowLog は Issue 運用がしっかりしており（2026-08-30 時点で open 15 件）、
やることは基本すべて Issue 化されている。ここに同じ内容を書くと二重管理になり、必ず片方が腐る。
このファイルには **Issue になっていないものだけ** を置く。Issue 化できたらここから消す。

## Issue 化されていない項目

**現在なし。** 唯一残っていた `src/app/video-import.tsx` の分割は
[#80](https://github.com/kmch4n/SnowLog/issues/80) になった。この節が空であることが本来あるべき状態で、
何か思いついたら Issue にしてここには書かない。

## 既に Issue がある主要テーマ（重複して書かないこと）

作業前にこの対応表を見て、既存 Issue を確認する。**2026-08-30 時点の open 15 件すべて**を載せている。
古い表は新しく立った Issue を落としたまま残っていて役に立たなかったので、更新するときは
`gh issue list --state open` から作り直すこと。追記していくと必ず漏れる。

| テーマ | Issue |
| --- | --- |
| Web が起動時にクラッシュする（`openDatabaseSync` 不在） | [#84](https://github.com/kmch4n/SnowLog/issues/84) |
| 未参照の i18n キー 93 件 | [#83](https://github.com/kmch4n/SnowLog/issues/83) |
| CI 不在 | [#82](https://github.com/kmch4n/SnowLog/issues/82) |
| 改行コード方針が `.gitattributes` に無い | [#81](https://github.com/kmch4n/SnowLog/issues/81) |
| `video-import.tsx` の分割 | [#80](https://github.com/kmch4n/SnowLog/issues/80) |
| アクセシビリティ（72 個中 66 個の touchable に role/label 無し） | [#79](https://github.com/kmch4n/SnowLog/issues/79) |
| Expo SDK 55 の依存 26 件が期待バージョン未満 | [#78](https://github.com/kmch4n/SnowLog/issues/78) |
| `.web` シムの export 欠落 | [#74](https://github.com/kmch4n/SnowLog/issues/74) |
| JSON エクスポートの導線復活とインポート実装 | [#72](https://github.com/kmch4n/SnowLog/issues/72) |
| iCloud ダウンロードの制御 | [#70](https://github.com/kmch4n/SnowLog/issues/70) |
| カスタムタグ UI の見直し | [#69](https://github.com/kmch4n/SnowLog/issues/69) |
| Reels 取り込みの検討 | [#54](https://github.com/kmch4n/SnowLog/issues/54) |
| Large Title ヘッダー | [#47](https://github.com/kmch4n/SnowLog/issues/47) |
| Liquid Glass の拡張 | [#46](https://github.com/kmch4n/SnowLog/issues/46) |
| ホームの長押し選択をコンテキストメニューに | [#45](https://github.com/kmch4n/SnowLog/issues/45) |

### #72 と #74 はコードが入っているのに open

「もう終わっているのでは」と読まれないように理由を書いておく。どちらも**残りが手元で確認できない作業**である。

- **[#72](https://github.com/kmch4n/SnowLog/issues/72)** — エクスポート（2026-08-30）とインポート（2026-08-31）の
  実装・テストは入った。残りは **実機での検証だけ**。`expo-document-picker` を足したので
  **dev client の再ビルドが先に要る**。なおバックアップはメタデータのみで動画ファイルを含まないため、
  別端末ではログしか戻らない。README と `pr/web` の「移行できない」という記述は**まだ正しい**。
- **[#74](https://github.com/kmch4n/SnowLog/issues/74)** — 9 件の export 欠落は埋め、
  `scripts/tests/webShimParity.test.cjs` で再発を止めた（`cd0a746`〜`e2d5e05`）。
  残りは受け入れ基準の「Web で 4 操作をクリックして確認」だけだが、
  **[#84](https://github.com/kmch4n/SnowLog/issues/84) で Web が起動しないため実行できない。**

## 完了済み（2026-03-26 に挙がっていた 3 件）

再提案を防ぐため記録を残す。いずれも実装済み。

| 項目 | 実装先 |
| --- | --- |
| 撮影地からスキー場をサジェスト | `src/utils/geoUtils.ts`（GPS → Haversine 最近傍）、`src/hooks/useSkiResortSuggestions.ts`、`src/constants/skiResorts.json`（378 件・座標入り）。Issue [#68](https://github.com/kmch4n/SnowLog/issues/68) / コミット `a0bfd29`・`0305ba4` |
| 動画詳細の拡充表示（時刻・解像度・秒数） | `src/app/video/[id].tsx` — `mediaService` の `getAssetInfoAsync` から `width` / `height` / `duration` を取得して表示 |
| 写真アプリで開くボタン | `src/app/video/[id].tsx` — `Linking.openURL("photos-redirect://")` |
