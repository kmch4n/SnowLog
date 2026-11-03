---
title: バックログ
updated: 2026-11-02
status: active
---

# バックログ

コードや git log からは読み取れない「これからやりたいこと」の置き場。

**大原則: GitHub Issues が正。** SnowLog は Issue 運用がしっかりしており（2026-11-02 時点で open 12 件 / 全 86 件）、
やることは基本すべて Issue 化されている。ここに同じ内容を書くと二重管理になり、必ず片方が腐る。
このファイルには **Issue になっていないものだけ** を置く。Issue 化できたらここから消す。

## Issue 化されていない項目

**現在なし。** 唯一残っていた `src/app/video-import.tsx` の分割は
[#80](https://github.com/kmch4n/SnowLog/issues/80) になった。この節が空であることが本来あるべき状態で、
何か思いついたら Issue にしてここには書かない。

## 既に Issue がある主要テーマ（重複して書かないこと）

作業前にこの対応表を見て、既存 Issue を確認する。**2026-11-02 時点の open 12 件すべて**を載せている。
古い表は新しく立った Issue を落としたまま残っていて役に立たなかったので、更新するときは
`gh issue list --state open` から作り直すこと。追記していくと必ず漏れる。

| テーマ | Issue |
| --- | --- |
| 動画の保存方式の選択。Task B・D の中核は実装済み。残るは Task A・C（ネイティブ）・E・F・G と実機検証。1.4.0 は main から出し 0009 を含める（§9 で決定） | [#86](https://github.com/kmch4n/SnowLog/issues/86) |
| 「選択した写真のみ」の範囲外の動画を取り込むときの警告（#87 の残り。ブロックか警告か、文言が要判断） | [#91](https://github.com/kmch4n/SnowLog/issues/91) |
| 復元した動画を新端末の写真ライブラリに再リンクする | [#85](https://github.com/kmch4n/SnowLog/issues/85) |
| `video-import.tsx` の分割（#86 Task E で行う） | [#80](https://github.com/kmch4n/SnowLog/issues/80) |
| アクセシビリティのラベル（アイコンのみ・データ駆動の操作）。ロールの付与は 2026-11-02 に完了 | [#79](https://github.com/kmch4n/SnowLog/issues/79) |
| Expo SDK 55 の依存 26 件が期待バージョン未満。1.4.0 リリース後、#86 Task A の前に行う | [#78](https://github.com/kmch4n/SnowLog/issues/78) |
| iCloud ダウンロードの制御（#86 のサブ Issue） | [#70](https://github.com/kmch4n/SnowLog/issues/70) |
| カスタムタグ UI の見直し | [#69](https://github.com/kmch4n/SnowLog/issues/69) |
| Reels 取り込みの検討 | [#54](https://github.com/kmch4n/SnowLog/issues/54) |
| Large Title ヘッダー（ブランドの青いヘッダーが消える点を含めて要判断） | [#47](https://github.com/kmch4n/SnowLog/issues/47) |
| Liquid Glass の拡張（FilterBar はレイアウト変更が前提） | [#46](https://github.com/kmch4n/SnowLog/issues/46) |
| ホームの長押し選択をコンテキストメニューに（expo-router の `Link.Menu` で依存追加なしに可能） | [#45](https://github.com/kmch4n/SnowLog/issues/45) |

2026-10-31 に close: #84（Web が起動しない）、#82（CI 不在）、#81（`.gitattributes`）。
2026-11-02 に close: #83（`common.*` は削除）、#88（復元の設定上書きとタグ取りこぼし）。
2026-11-03 に close: #87（限定アクセスでの「ファイル無し」誤判定）、#89（シーズンを 10/1 区切りに）、#90（JSON バックアップを廃止し iCloud バックアップに一本化）。

### バックアップ往復（#72、のち廃止）と `.web` シム（#74）は closed

2026-08-31 に両方 close した。**ただしどちらも「完全に確認が済んだ」という意味ではない**ので、
再提案・再調査の前にここを読むこと。

- **[#72](https://github.com/kmch4n/SnowLog/issues/72)** — JSON のエクスポートとインポートは、実機で一度も動かさないまま
  1.4.0 で廃止した（#90）。バックアップは iOS の iCloud バックアップに任せる。[doc-drift.md](doc-drift.md) 項目 1 を参照。
- **[#74](https://github.com/kmch4n/SnowLog/issues/74)** — export 欠落 9 件は埋め、
  `scripts/tests/webShimParity.test.cjs` で再発を止めた。受け入れ基準の
  「Web で 4 操作をクリックして確認」は #84 の修正後、2026-10-31 にブラウザで確認済み。

## 完了済み（2026-03-26 に挙がっていた 3 件）

再提案を防ぐため記録を残す。いずれも実装済み。

| 項目 | 実装先 |
| --- | --- |
| 撮影地からスキー場をサジェスト | `src/utils/geoUtils.ts`（GPS → Haversine 最近傍）、`src/hooks/useSkiResortSuggestions.ts`、`src/constants/skiResorts.json`（378 件・座標入り）。Issue [#68](https://github.com/kmch4n/SnowLog/issues/68) / コミット `a0bfd29`・`0305ba4` |
| 動画詳細の拡充表示（時刻・解像度・秒数） | `src/app/video/[id].tsx` — `mediaService` の `getAssetInfoAsync` から `width` / `height` / `duration` を取得して表示 |
| 写真アプリで開くボタン | `src/app/video/[id].tsx` — `Linking.openURL("photos-redirect://")` |
