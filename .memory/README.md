# .memory — SnowLog 共有ナレッジベース

最終更新: 2026-07-15

## このフォルダの目的

SnowLog の開発は複数のコーディングエージェント（Claude Code / Codex など）と人間が交代で行う。
各エージェントが持つ**プライベートなメモリ機能に知識を溜めると、他のエージェントから参照できず暗黙知になる**。
それを防ぐため、エージェントをまたいで共有すべき知識はすべてこのフォルダに置き、リポジトリと一緒にバージョン管理する。

`.memory/` は git 追跡対象。エージェント指示ファイル（`.claude/CLAUDE.md` / `.codex/AGENTS.md` / `.codex/release-prompt.md`）も
2026-07-15 に `.gitignore` から外して追跡対象にした。**個人・マシンローカル用の `.claude/settings.local.json` だけは除外**している。

## 対象読者

- コーディングエージェント（Claude Code / Codex / その他）— 作業開始時にこの README を読み、関連するファイルを参照する
- 人間の開発者 — 過去の判断や既知の落とし穴を思い出すため

## 目次

| ファイル | 内容 |
| --- | --- |
| [doc-drift.md](doc-drift.md) | ドキュメントとコードの乖離。README.md / SnowLog.md / AGENTS.md / CLAUDE.md のどの記述が古いか |
| [testing.md](testing.md) | テストの実態と実行方法。npm script が無いので気づきにくい |
| [agent-rules.md](agent-rules.md) | エージェント共通の約束事。コミットへの AI 言及禁止など |
| [backlog.md](backlog.md) | 将来やること、および完了済み項目の記録 |

## 何をここに書き、何を書かないか

このフォルダは「**コードを読んでも分からないこと**」だけを置く。責務は次のように分ける。

| 情報 | 正となる場所 |
| --- | --- |
| バージョン・依存・npm script | `package.json` |
| テーブル定義 | `src/database/schema.ts` |
| アーキテクチャ・機能仕様 | `SnowLog.md` |
| コーディング規約・エージェント向け指示 | `.codex/AGENTS.md` / `.claude/CLAUDE.md` |
| **やること・バグ・改善提案** | **GitHub Issues**（`kmch4n/SnowLog`） |
| 上記から読み取れない知識・判断の背景・既知の乖離 | **`.memory/`（ここ）** |

書かないもの:

- コードを読めば分かること（ディレクトリ構成、関数の動作、過去の修正内容）
- git log に残っていること
- CLAUDE.md / AGENTS.md に既に書いてある規約（重複させない。両方に書くと片方が腐る）
- **GitHub Issue になっている作業項目**（Issue が正。ここに書くと二重管理になる）
- その場限りの会話メモ

Issue 運用は活発で、2026-07-15 時点で全 69 件（open 12 / closed 57）ある。
やることは基本 Issue にあると思ってよい。まず Issues を見ること。

## 書き方ルール

- 1 ファイル 1 トピック。ファイル名は英小文字ケバブケース。
- 先頭に frontmatter で `title` / `updated` / `status` を書く。`status` は `active`（有効）か `resolved`（解消済み・削除候補）。
- 本文は日本語。`README.md` / `SnowLog.md` に合わせる。
- 主張には根拠となるファイルパスを添える。行番号はすぐ腐るので、ファイル名＋シンボル名を優先する。
- **内容は点であって live state ではない**。`updated` から時間が経っていたら、断言する前に現在のコードで裏を取る。
- 状況が変わったら**その場で更新するか削除する**。古い記述を残すのが最悪。解消したものは `status: resolved` にし、次に触ったときに消す。
- ファイルを追加・削除したら、この README の目次も必ず更新する。
