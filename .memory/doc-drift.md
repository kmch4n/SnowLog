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

## 1. エクスポートは到達可能になったが未検証 — インポートは依然として未実装

**更新（2026-08-30）:** 旧項目「エクスポートが到達不能」は解消した。設定画面にエクスポート行を追加し、
`exportAllToJSON()` が iOS から呼べるようになった（Issue [#72](https://github.com/kmch4n/SnowLog/issues/72) のエクスポート側）。
ただし **2 点が残っているのでこの項目は消さない**。

**1. 実機で一度も動かしていない。** それ以前は `src/app/video/[id].web.tsx` からしか呼ばれておらず、
その import も web では `exportService.web.ts`（未対応 Alert）に解決されていたため、
ネイティブ実装は**どのプラットフォームでも実行された実績が無い**。
純粋部分（`src/services/exportPayload.ts`）は `scripts/tests/exportPayload.test.cjs` で検証済みだが、
ファイル書き出し・共有シート・リポジトリ往復は未検証。**実機で通すまでは未検証コードとして扱うこと。**

**2. インポート（JSON 復元）は未実装。** `readAsStringAsync` / `DocumentPicker` / `getDocumentAsync` /
`importFromJSON` は全て 0 ヒットで、`expo-document-picker` の依存も無い。
`src/services/importService.ts` は名前に反して写真ライブラリからの動画取り込み。
**したがって機種変更時のデータ移行は依然としてできない。**

そのため次の 2 つの記述は**現時点で正しく、変えてはいけない**。

- `README.md` の「いまはできないこと」→ 移行不可。インポートが入るまで正しい。
- `pr/web/src/content.ts` の FAQ「機種変更時にデータは引き継がれますか？」→
  「JSON形式でのエクスポートを実装予定ですが、時期は未定です」。
  **Web サイトは出荷済みアプリを説明するもの**で、エクスポートはまだ release に載っていない。
  エクスポートを含む version を出すときに直す。`.codex/release-prompt.md` の更新対象に `pr/web` の FAQ が
  含まれているので、release 手順を踏めば拾える。

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
