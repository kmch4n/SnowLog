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

`.claude/CLAUDE.md` と `.codex/AGENTS.md` はファイルを ~500〜700 行に収めるよう定めているが、`src/app/video-import.tsx` は約 1,300 行あり大きく超えている。規約違反として認識されており、分割候補。

---

## 参考: `.web` シムの export 欠落は体系的（Issue [#74](https://github.com/kmch4n/SnowLog/issues/74)）

2026-07-25 に Issue #71（`mediaService.web.ts` が `isSyntheticAssetId` を落としていた）を直す過程で、
native と `.web` の export を全ペア突き合わせたところ、**同種の欠落が他に 10 件**あった。

| シム | native にあって `.web` に無い export |
| --- | --- |
| `videoRepository.web.ts` | `bulkSetFavorite` / `deleteVideos` / `getExistingAssetIds` / `getVideosWithSuspiciousCapturedAt` / `updateVideoThumbnailUri` |
| `tagRepository.web.ts` | `deleteCustomTag` |
| `techniqueOptionRepository.web.ts` | `reorderTechniqueOptions` |
| `managedVideoFileService.web.ts` | `getManagedVideoDirectoryUri` |
| `thumbnailService.web.ts` | `getThumbnailDirectoryUri` |

`tsc --noEmit` はこれを検出できない。specifier は native 側に解決され、`.web` への差し替えは Metro のバンドル時だけだからである。
呼び出し元に `.web` companion があるものは実害が無い（例: `getManagedVideoDirectoryUri` の唯一の利用者
`orphanedFileCleanupService` は自前の `.web` を持つ）が、`deleteVideos` / `bulkSetFavorite` のようにホーム
（`src/app/(tabs)/index/index.tsx`、`.web` 無し）から辿れるものは Web で `TypeError` になる。

再確認コマンド:

```bash
for f in src/database/repositories/*.ts src/services/*.ts; do
    case "$f" in *.web.ts) continue;; esac
    w="${f%.ts}.web.ts"; [ -f "$w" ] || continue
    diff <(grep -oE "^export (async )?function [a-zA-Z]+" "$f" | grep -oE "[a-zA-Z]+$" | sort) \
         <(grep -oE "^export (async )?function [a-zA-Z]+" "$w" | grep -oE "[a-zA-Z]+$" | sort)
done
```
