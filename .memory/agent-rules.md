---
title: エージェント共通の約束事
updated: 2026-11-22
status: active
---

# エージェント共通の約束事

`AGENTS.md` は常時ロードされる最小限の共通ルールであり、`.claude/CLAUDE.md` はその import 1 行だけを持つ。
詳細な規約・判断の経緯は本ファイル、実装仕様は `docs/spec/`、実行・テスト上の注意は `.memory/testing.md` 等に分ける。
これらは作業に必要なときだけ参照し、常時ロード文書へ重複記載しない。

## 指示ファイルの構成（2026-11-21 更新）

**Claude Code は `CLAUDE.md` しか自動で読まない。`AGENTS.md` は読まない**（リポジトリ直下に置いても読まれない）。
これは Claude Code の仕様で、[公式ドキュメント](https://code.claude.com/docs/en/memory)に明記されている。

そのため `.claude/CLAUDE.md` の冒頭に `@../AGENTS.md` という **import** を置いてある。
これで起動時に AGENTS.md の実体が展開され、Claude も Codex と同じ規約を読む。

- **`@` はバックティックで囲むと import されない**。CLAUDE.md 内で単にパスに言及したいときは `` `@foo` `` と書く。
  逆に import したいときはバックティックを外す。うっかり囲むと黙って無効になるので注意。
- 相対パスは **import 元ファイル基準**で解決される（`.claude/CLAUDE.md` からなので `../`）。
- import は最大 4 ホップまでネストできる。
- 初回は Claude Code が import の承認ダイアログを出す。**ここで拒否すると import は恒久的に無効化され、ダイアログも二度と出ない。**

2026-10-21 に AGENTS.md を `.codex/AGENTS.md` からリポジトリ直下へ移した。Codex がプロジェクトの `.codex/AGENTS.md` を自動で読まなくなったため。import 先もそれに合わせて `../AGENTS.md` に変えた。

以前は重複を許容していたが、2026-11-21 に `.claude/CLAUDE.md` を `@../AGENTS.md` の1行だけに整理した。
Claude 固有の補足も常時ロードしない。新しい共通指示は必要性を厳選して `AGENTS.md` に書き、理由や詳細は本ファイルなどに置く。

## コミットに AI の痕跡を残さない

コミットメッセージ・Issue・PR 説明・コードコメントに、Claude / Codex / その他 AI エージェントへの言及を**一切含めない**。
具体的には次を書かない。

- `Co-Authored-By: Claude ...` などの共著者行
- 「AI が生成した」旨の注記
- ツール名への言及

理由: ユーザーが明示的に不要と指示している。

このルールは `AGENTS.md` に短く記載し、理由と具体的な禁止例をここに残す。
Claude Code は `.claude/CLAUDE.md` から `AGENTS.md` を import するため、別々に記述する必要はない。

## git の書き込み操作は事前承認なしで行ってよい（2026-07-15 方針転換）

**依頼された実装に伴う `git add` / `commit` / `push`、および GitHub の通常の書き込み操作（Issue 作成・コメント・PR 作成・tag）は、追加の確認なしで実行してよい。**

**破壊的操作と本番リリース・デプロイは明示的な許可が必要。** `reset --hard` / force push / ブランチ削除、および App Store 提出・本番公開などはこの例外に該当する。

### グローバル設定との衝突に注意

ユーザーのグローバル指示ファイル 4 つは、**いまも「明示的指示があるまで禁止」と書いてある**。

- `~/.claude/CLAUDE.md`（Git Operations Policy）
- `~/.claude/rules/commit_message.md`（Git Safety Policy）
- `~/.codex/AGENTS.md`
- `~/.codex/commit_message.md`（Git Safety Policy）

2026-07-15 に方針転換した際、ユーザーは**適用範囲を SnowLog だけに限定する**判断をした（他プロジェクトの挙動を変えたくないため）。
そのためグローバル側はあえて据え置いてある。**SnowLog のプロジェクト固有の運用方針は `AGENTS.md` に集約**し、
Claude Code は `.claude/CLAUDE.md` から import して参照する。

グローバルを読んで「禁止されている」と早合点しないこと。逆に、この緩和を他プロジェクトへ持ち出さないこと。

### ブランチは切らず main に直接コミットする

SnowLog は原則として単独開発の `main` 直接コミット運用だが、**依頼に応じてブランチ・PRを利用する**。
2026-11-21 時点で仕様書作成用 PR #95 が存在する。2026-08-30 のコミット数・履歴分析は以下の当時の記録であり、現況とは分けて扱う。

かつてここには「マージコミット 0 件 / コミッターは `kmch4n` のみ」と書いてあったが、どちらも現在は正確でない。
**ルールは変えない。事実だけ更新する。**

- **マージコミットは 2 件ある** — `f6cf9a5` と `9cda49c`。どちらも PV（`pr/pv`）の作業ブランチを
  GitHub の Web UI 上でマージしたもの。日常の運用が変わったわけではない。
- **author 名は 2 種類ある。どちらも本人。** `kmch4n <kmchan@kmchan.jp>` が 268 件、
  `Kotaro <47635644+kmch4n@users.noreply.github.com>` が 2 件で、後者は GitHub Web UI が使う
  noreply アドレス（上記 2 件のマージがこれ）。`AGENTS.md` は「identity が bot に見えたら止めて報告する」と
  定めているので、`git log --format=%an` で見慣れない名前を見つけた人が毎回調べ直さずに済むようここに記録する。

多くのコーディングエージェントは「デフォルトブランチでは作業しない、まずブランチを切る」を既定の安全策として持っている。
**このリポジトリでは、依頼されていなければ新規ブランチを作成しない。**
ただし、すでに進行中の依頼がブランチ・PRで管理されている場合、その既存ブランチ上で継続する。
`AGENTS.md` はこの例外も含めて簡潔に定める。

### コミットは分割する

ユーザーが特に重視している点。**1 コミット 1 論理変更**。無関係な変更を 1 つにまとめない。
大きな 1 コミットより小さな複数コミットを選ぶ。作業を始める前に、どう分割するか見当をつけておく。

### コミット作者の本人確認（2026-11-22 方針明確化）

Git の author / committer が本人の GitHub アカウント **`kmch4n`** に紐づくことを確認する。許容するメールアドレスは
`kmchan@kmchan.jp`（通常のローカル Git 設定）と `47635644+kmch4n@users.noreply.github.com`（GitHub のプライベートメール）の2種類。
メールアドレス表記そのものではなく本人のアカウントへの帰属が目的であり、**表示名が `kmch4n` というだけで本人と判断しない**。
ローカルコミットでは `git config user.name` / `user.email` と直近の履歴を照合し、GitHub へ反映したコミットでは
GitHub の author / committer アカウント紐づけを確認する。不明な場合や bot・サービスアカウントに見える場合は作業を止めて報告する。

この方針の明文化は PR #95 のレビューを受けたもの。明文化前に作成した同PRの8コミットについては、GitHub 上で author / committer が
いずれも `kmch4n` に紐づいていることを確認済み。**既存コミットの元の規約への適合を遡及的に主張するものではなく、履歴も書き換えない**。

## コミットメッセージ形式

`[gitmoji] English message`（1 行目 72 文字以内・現在形）。例: `[✨] Add seasonal dashboard tab`。
`[` と `]` は必須。起票前に直近 10 件のコミットを確認して形式を揃える。

## 議論と実装を混ぜない

設計相談・レビュー・ブレストの段階では、既定で読み取り専用として振る舞う。
ユーザーが明示的に実装を依頼するまで、ファイル編集やパッチ生成を始めない。
意図が曖昧なら、推奨案を提示して確認を取る。

## コーディング規約（関連する実装時だけ参照）

- TypeScript `strict`。既存コードと同じ 4 スペース・ダブルクォート、`PascalCase` コンポーネント、`camelCase` 関数、`UPPER_SNAKE_CASE` 定数、`useXxx` フック、`@/` エイリアス。安易な `any` を避け、必要なら根拠を添える。
- ルートは画面構成に留め、DB・ファイル I/O・処理順序は hook / service / repository / pure utility へ分離する。500–700 行を超えて肥大化した画面は分割候補として扱う（既存の例外: `video-import.tsx`、Issue #80）。
- npm と `package-lock.json` を使用。ビルドで生成される `drizzle/` の SQL・`ios/`・`android/`・各種成果物を手編集・追加しない（DBスキーマは `src/database/schema.ts`）。
- ユーザー表示の文言は `useTranslation()` または `t` を使い、`src/i18n/locales/ja.ts` と `en.ts` を揃える。権限ダイアログ文面はルート `locales/ja.json` / `en.json` にも注意。
- ネイティブ依存をWebから参照する場合は `.web.ts(x)` シムとエクスポート整合性を確認する。`tsc` だけでは Metro のプラットフォーム解決を検証できない。
- 直接 `expo-haptics` / `expo-symbols` を呼ばず、`hapticsService` / `Icon` の共通窓口と `constants/colors.ts`・`motion.ts` の定義を優先する。詳細は `.memory/wiring.md` と `.memory/apple-design-rn.md`。
- テスト・CI・シミュレータ・実機検証の使い分けは `.memory/testing.md` と `docs/spec/verification-and-release.md` を参照する。

## 言語

- ユーザーとの会話: 日本語
- 新しいコード・コメント・コミットメッセージ・Issue・PR・`docs/spec/`: 英語
- 既存の `README.md` / `SnowLog.md` / `.memory/`: 日本語（従来の慣習を保つ）
