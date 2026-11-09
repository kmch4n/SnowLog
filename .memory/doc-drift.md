---
title: ドキュメントとコードの乖離
updated: 2026-11-09
status: active
---

# ドキュメントとコードの乖離

既存ドキュメントのうち、**現在のコードと食い違っている記述**の一覧。ドキュメントを鵜呑みにして実装すると壊れる箇所なので、着手前に確認する。
修正できたタイミングで、該当項目をこのファイルから消すこと。

2026-07-25 の Issue 監査バッチで、旧 1（i18n 記述）・2（`orphanedFileCleanupService` 未記載）・4（権限文言）を解消して削除した。
残っているのは以下の 3 件。

## 1. バックアップは iOS の iCloud バックアップに任せた。出荷済みの文書はまだ JSON を説明している

**更新（2026-11-03）:** JSON ファイルの書き出し・復元（#72）を廃止した（#90）。アプリ独自のバックアップは持たず、
`Documents`（DB・サムネイル・アプリ内の動画）を含む iOS の iCloud バックアップに任せる。設定画面の末尾に
その旨を 1 行出している。仕様は `SnowLog.md` §11。復元専用のコード（`importPayload.ts`、`*ForRestore` など）も削除した。

**「機種変更に対応した」と書いてはいけない。** 理由は変わっていない。

- `videos.assetId` は `PHAsset.localIdentifier` で、端末ローカルの値。iCloud バックアップから復元した
  新しい端末で同じ写真を指すかは**未確認**。写真ライブラリの動画は再生できない状態で戻る可能性がある。
- アプリを削除すると記録も消え、再インストールでは戻らない（戻せるのは端末の初期設定時の復元だけ）。
- 動画の再リンクは #85 で、まだ無い。

### 文面は更新済み。外に出すのは 1.4.0 の公開に合わせる

2026-11-09 に、次の 2 つをリポジトリ上で書き換えた（「記録は iPhone の iCloud バックアップに含まれる／
アプリを削除すると消える／動画は新しい端末で再生できないことがある」。「移行できる」とは書かない）。

- `appstore/about.txt`: 1.4.0 を審査に出すとき、App Store Connect の「説明」に貼り直す。
- `pr/web/src/content.ts` の FAQ「機種変更時にデータは引き継がれますか？」: サイトは手動デプロイ
  （`pr/web/README.md`）。1.4.0 が App Store で公開されてからデプロイする。それまでは公開中のサイトが
  1.3.0 の JSON バックアップを案内したままで正しい。

両方が外に出たら、この項目ごと消す。`README.md` と `SnowLog.md` は 2026-11-03 に更新済み。

## 2. 【解消済み 2026-09-13】保存方式が `assetId` の形から推測されていた

かつて `src/database/schema.ts:5` のコメントは「動画ファイルのコピーは保持しない（参照方式）」と
書いていたが、実際には `isSyntheticAssetId(asset.id)` が真のとき
`managedVideoFileService.persistManagedVideoFile()` が動画本体を `documentDirectory/videos/` へ
`copyAsync` していた。判定が「写真ライブラリ上の身元があるか」と「バイトがどこにあるか」の
2 つを 1 つの述語で兼ねていたのが原因。

[#86](https://github.com/kmch4n/SnowLog/issues/86) の Task B で分離した。

- 保存方式は `videos.storage_mode`（`reference` / `copy`）が持ち、実体の位置は
  `videos.managed_video_path`（`videos/<id>.<ext>` の相対パス）が持つ。
- 既存行は起動時のバックフィルで一度だけ埋める（`storageMigrationService`）。
  掃除・サムネイル修復・撮影日修復はこれが commit するまで走らない。
- `isSyntheticAssetId` は**身元の判定としてだけ**残った。現在の利用箇所は 2 つ、
  `video/[id].tsx` の `canOpenPhotosApp` と `_layout.tsx` の撮影日修復スキップ。
  コピーした動画にも写真ライブラリ側の原本がありうるので、この 2 つは保存方式では判定できない。

**まだ一致していない点**: 方式をユーザーが選ぶ UI はまだ無い。取り込み時は今も
「synthetic なら copy」で、身元と保存方式は結果的に一致している。両者が分かれるのは
#86 の Task C 以降。

## 3. ファイルサイズ規約の逸脱

`.claude/CLAUDE.md` と `AGENTS.md` はファイルを ~500〜700 行に収めるよう定めているが、`src/` に超えているファイルが 2 つある
（2026-11-09、`e838b14` で計測）。

- `src/app/video-import.tsx` — **1,447 行**。Issue [#80](https://github.com/kmch4n/SnowLog/issues/80)（#86 Task E でまとめて分割する）。
- `src/app/video/[id].tsx` — **811 行**。#87 の修正で 750 行から増えた。自動保存と再生元の解決をフックに出す。
  Issue [#92](https://github.com/kmch4n/SnowLog/issues/92)。

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
