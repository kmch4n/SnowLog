---
title: テストの実態と実行方法
updated: 2026-07-15
status: active
---

# テストの実態と実行方法

## テストは存在するが `npm test` では走らない

**`scripts/tests/` に `node:test` ベースのテストが 5 ファイル・18 ケースある。**

かつて `.codex/AGENTS.md` と `.claude/CLAUDE.md` は「自動テストは無い」と書いていたが、
2026-07-15 に両方とも実態へ修正済み。**現在はどちらの記述も正しい**ので、乖離として扱わなくてよい。
気づきにくさの原因は、いまはドキュメントではなく次の点にある。

- `bulkImportProgressUtils.test.cjs`
- `homeSwipeDelete.test.cjs`
- `versionUtils.test.cjs`
- `videoDetailKeyboardAccessory.test.cjs`
- `videoListEquality.test.cjs`

`package.json` に `test` script が**定義されていない**ため、`npm test` では走らず存在に気づきにくい。

## 実行方法

```bash
node --test "scripts/tests/*.test.cjs"
```

glob をクォートで囲むこと。**`node --test scripts/tests/` のようなディレクトリ指定は Node 25 / Windows で `MODULE_NOT_FOUND` になり動かない**（2026-07-15 に確認）。

## 現状 main で 1 件失敗している（2026-07-15 時点）

```
tests 18 / pass 17 / fail 1
```

失敗しているのは `homeSwipeDelete.test.cjs` の
「home swipe delete action uses an iOS-style icon and compact system red surface」。

**原因はテストの陳腐化であって、動作の退行ではない。** このテストは `src/components/VideoCardCompact.tsx` が
`import { SymbolView } from "expo-symbols"` を直接 import し `name="trash"` / `tintColor={...}` を書いていることを期待しているが、
同コンポーネントは `@/components/ui/Icon` ラッパー経由（`name={IconNames.trash}` / `color={Colors.headerText}`）に refactor 済み。
アイコン表示も赤い削除面も実際には壊れていない。テスト側の期待値を Icon ラッパーに追随させれば直る。

そのため**「テストが 1 件落ちている」＝自分の変更が壊した、とは限らない**。変更前のベースラインを取ってから判断すること。

## テストの性質 — 振る舞いではなくソース文字列を見ている

これらのテストは**コンポーネントを描画せず、`readFileSync` でソースを読んで正規表現で `assert.match` するだけ**。
つまり実質的には「実装の書き方」を固定するスナップショットであり、次の性質を持つ。

- 振る舞いが正しくても、書き方を変えた（抽象化した・変数名を変えた）だけで落ちる
- 逆に、書き方さえ合っていれば実際に壊れていても通る

リファクタ時に落ちたら、まず**テストが実装の変更に追随していないだけではないか**を疑う。
新しくテストを足すなら、この方式を惰性で踏襲するかどうかは一考の余地がある。
ちゃんとしたテスト基盤（Vitest / Jest で純粋関数を対象）の導入は Issue
[#38](https://github.com/kmch4n/SnowLog/issues/38) で提案されている。

## 主要な検証手段は依然として手動

自動テストは補助的で、iOS 実機/シミュレータでの手動確認が主。
スキーマ・インポート・エクスポート・ダッシュボードに触ったら、`migrate → import → search → export` の全フローを通す。
`*.web.tsx` に触ったときだけ Web も確認する。
PR 前には `npm run lint` も実行する。
