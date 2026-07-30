---
title: ドキュメントとコードの乖離
updated: 2026-07-25
status: active
---

# ドキュメントとコードの乖離

既存ドキュメントのうち、**現在のコードと食い違っている記述**の一覧。ドキュメントを鵜呑みにして実装すると壊れる箇所なので、着手前に確認する。
修正できたタイミングで、該当項目をこのファイルから消すこと。

2026-07-25 の Issue 監査バッチで、旧 1（i18n 記述）・2（`orphanedFileCleanupService` 未記載）・4（権限文言）を解消して削除した。
残っているのは以下の 3 件。

## 1. エクスポートが到達不能 —『設定からエクスポートできる』は誤り

**古い記述:** `pr/web` の FAQ が「アプリ内設定から JSON でエクスポートし、新しい端末で読み込む」と案内していた（2026-07-17 に修正済み）。
`README.md` も「全データの JSON エクスポート（`expo-sharing` 経由）を備える」と主張していた（2026-07-30 に修正済み。
現在は README の「いまはできないこと」と `docs/design-notes.md` で未到達であることを明示している）。
`src/i18n/locales/{ja,en}.ts` には `settings.menu.export`（「ライブラリ全体を JSON でエクスポートします」）と `settings.export.*` ブロックが残っている。

**実態:**

- `exportAllToJSON()`（`src/services/exportService.ts`）の呼び出し元は **`src/app/video/[id].web.tsx` のみ** — Web 検証スタブのヘッダーボタンで、iOS からは到達できない。
- 設定画面（`src/app/(tabs)/settings/index.tsx`）の `SettingsRoute` は calendar / techniques / favorite-resorts / tags / duplicate-candidates の 5 つ + ストレージ整理行のみで、エクスポート行は無い。
- 死んでいる i18n 文言は `settings.menu.export` と `settings.descriptions.export` の 2 つ。`settings.export.*` ブロックは web 経路（`video/[id].web.tsx`）と `exportService` 自身から参照されており生きている（未参照は `title` / `description` / `buttonLabel` / `success` のみ）。
- なお `video/[id].web.tsx` の import は web では `exportService.web.ts`（未対応 Alert）に解決されるため、ネイティブ実装の `exportAllToJSON()` は**どのプラットフォームからも到達不能**。一度も実行された実績が無い未検証コードとして扱うこと。
- **インポート（JSON 復元）は未実装**。`readAsStringAsync` / `DocumentPicker` / `getDocumentAsync` / `importFromJSON` は全て 0 ヒットで、`expo-document-picker` の依存も無い。`src/services/importService.ts` は名前に反して写真ライブラリからの動画取り込み。

結果として、現状の実装では機種変更時のデータ移行ができない。エクスポートは将来実装予定。
作業は Issue [#72](https://github.com/kmch4n/SnowLog/issues/72) で管理。

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
