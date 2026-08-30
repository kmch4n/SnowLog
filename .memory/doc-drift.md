---
title: ドキュメントとコードの乖離
updated: 2026-08-30
status: active
---

# ドキュメントとコードの乖離

既存ドキュメントのうち、**現在のコードと食い違っている記述**の一覧。ドキュメントを鵜呑みにして実装すると壊れる箇所なので、着手前に確認する。
修正できたタイミングで、該当項目をこのファイルから消すこと。

2026-07-25 の Issue 監査バッチで、旧 1（i18n 記述）・2（`orphanedFileCleanupService` 未記載）・4（権限文言）を解消して削除した。
残っているのは以下の 3 件。

## 1. バックアップは往復できるようになったが、実機で一度も動かしていない

**更新（2026-08-31）:** エクスポートに続いてインポートも実装した
（Issue [#72](https://github.com/kmch4n/SnowLog/issues/72)）。設定画面に「エクスポート」と
「バックアップから復元」の 2 行がある。**それでもこの項目は消さない。** 理由が 2 つ変わっただけで残っている。

**1. どちらも実機で実行された実績が無い。** 純粋部分（`exportPayload.ts` / `importPayload.ts`）は
`scripts/tests/` で検証しているが、ファイル入出力・共有シート・ファイルピッカー・DB 往復は未検証。
`expo-document-picker` はネイティブモジュールなので、**まず dev client の再ビルドが要る。**
実機で通すまでは両方とも未検証コードとして扱うこと。

**2. 復元しても動画は戻らない。** バックアップは**メタデータのみ**で、動画ファイルもサムネイル画像も含まない。
`assetId` は写真ライブラリのローカル識別子で、別端末では解決できない。`thumbnailUri` も
`documentDirectory` 配下のパスなので引き継がれない。したがって

- **別端末**での復元 → ログ（メモ・タイトル・種別・タグ・スキー場・お気に入り・日記、およびそこから
  計算されるカレンダーと統計）は戻るが、動画は `isFileAvailable = 0` でサムネイル無し。
- **同一端末**での再インストール等 → アセットもサムネイルファイルも残っているので完全に復元される。

**「機種変更に対応した」と書いてはいけない。** 動画の再リンク（filename + capturedAt + duration で
新しい端末の写真ライブラリを突き合わせ、サムネイルを再生成する）は別機能で、まだ無い。

### 実装上の約束事（触る前に読む）

- **復元は insert-or-ignore。既存行は上書きせず飛ばす。** 冪等で、バックアップ後の編集を壊さない。
- **同一性は自然キーで決める。** タグは `name + type`、種別は `name`、日記は `dateKey`。
  バックアップ内の `id` はローカルの連番なので、別 DB では別物を指す。
  **動画とタグの紐付けも id ではなく名前で運ぶ。**
- **`insertVideosForRestore` は件数ではなく挿入した id を返す。** これは最適化ではなく必須。
  `setTagsForVideo` は既存リンクを全削除してから張り直すため、スキップした動画に対して呼ぶと
  ユーザーが後から付けたタグを消す。さらに `assetId` は unique だが `id` とは独立なので、
  同じ写真が別 UUID で既存の場合、その id で `video_tags` に挿すと外部キー違反で落ちる。
- **`isFileAvailable` は復元時に実測する。** バックアップの値も 0 固定も使えない。
  `isFileAvailable` を 1 に戻す経路がアプリ内に存在しない（`video/[id].tsx` が 0 に落とすだけ）ため、
  どちらの手抜きも片方の状況で永続的に誤った表示になる。
- **設定は `home_sort_order` と `weekStartDay` だけ戻す。** マイグレーション記録
  （`thumbnail_migration_version` / `capturedAt_repair_version`）を書き戻すと、新規インストールで
  当該マイグレーションを飛ばす。詳細は [wiring.md](wiring.md) の `app_preferences` の節。

### まだ変えてはいけない記述

- `README.md` の「いまはできないこと」→ **機種変更時のデータ移行**。動画が戻らない以上まだ正しい。
  文面を変えるとしても「ログは移せるが動画は移せない」までで、「移行できる」にしてはいけない。
- `pr/web/src/content.ts` の FAQ「機種変更時にデータは引き継がれますか？」→ 同上。
  加えて **Web サイトは出荷済みアプリを説明するもの**で、この機能はまだ release に載っていない。
  `.codex/release-prompt.md` の更新対象に `pr/web` の FAQ が含まれているので、release 手順を踏めば拾える。

## 2. `schema.ts` のコメント『動画ファイルのコピーは保持しない（参照方式）』は不正確

`src/database/schema.ts:5` のコメントに反して、`managedVideoFileService.persistManagedVideoFile()`
が `${FileSystem.documentDirectory}videos/` へ動画本体を `copyAsync` する。

発動条件は `isSyntheticAssetId(asset.id)`（assetId が `"synthetic:"` 始まり = 写真ライブラリのアセットとして扱えない動画）の場合のみで、
`src/services/importService.ts` が唯一の呼び出し箇所。通常の写真ライブラリ動画は参照のみで正しい。
コピーは動画削除時（`videoDeletionService.ts`）とアンインストール時に消える。

判定関数と `"synthetic:"` プレフィックスは 2026-07-25 に `src/utils/assetId.ts` へ集約した（Issue #71）。

## 3. ファイルサイズ規約の逸脱

`.claude/CLAUDE.md` と `.codex/AGENTS.md` はファイルを ~500〜700 行に収めるよう定めているが、
`src/app/video-import.tsx` は **1,371 行**あり大きく超えている。`src/` で規約を超えているのはこの 1 ファイルだけ。
作業は Issue [#80](https://github.com/kmch4n/SnowLog/issues/80) で管理している。

---

## 解消済み: `.web` シムの export 欠落（Issue [#74](https://github.com/kmch4n/SnowLog/issues/74)）

2026-07-25 に Issue #71（`mediaService.web.ts` が `isSyntheticAssetId` を落としていた）を直す過程で、
native と `.web` の export を全ペア突き合わせたところ、**同種の欠落が他に 9 件**あった
（Issue #74 のタイトルと本文は 10 件と書いているが、同じ Issue の表は 9 件しか挙げておらず、実測も 9 件。
`videoRepository` 5 / `tagRepository` 1 / `techniqueOptionRepository` 1 / `managedVideoFileService` 1 / `thumbnailService` 1）。

**2026-08-30 に 9 件すべて埋めた。手作業での再確認はもう要らない。**
`scripts/tests/webShimParity.test.cjs` が全 native/`.web` ペアを突き合わせ、
シム側に足りない export があればスイートを落とす。

この検査について、消す前に知っておくべきこと。

- **値 export だけを見る。** 型 export は実行時に消え、型の参照は必ず native 側に解決されるので、
  シムに型が無くても `TypeError` にも型エラーにもならない。型パリティを強制すると、
  誰も読まない型をシムに再宣言させるだけになる。
- **`tsc` はこの種の乖離を検出できない。** specifier は native に解決され、`.web` への差し替えは
  Metro のバンドル時だけだからである。だからテストが要る。
- **パーサ自身を検査するケースを消さないこと。** `export { … } from` を読む分岐を壊しても
  **パリティ検査は緑のまま**通る。`mediaService` は native と shim の両方が同じ re-export 行を使っており、
  両側から同時に同じ名前が消えて差分が空になるためである（2026-08-30 に変異で実測）。
  この失敗を捕まえるのは `the parser understands re-export and plain function forms` だけ。
- **`export *` はサポート外の形式として扱い、シム対に現れたら落とす。** 黙って読み飛ばすと
  検査が素通りする。`src/database/index.ts:16` に 1 件あるが、`.web.ts` の相方が無いのでペア一覧に入らない。
