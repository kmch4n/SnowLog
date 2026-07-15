# SnowLog バージョンアップ手順プロンプト

SnowLog のバージョンアップを進めるときは、この手順に従ってください。
会話は日本語で行い、commit message / GitHub Release / Issue / PR などのリポジトリ成果物は英語で作成してください。

## 基本方針

- Git 操作（add / commit / push）・GitHub 書き込み・tag 作成・GitHub Release 公開は、事前承認なしに任意のタイミングで実行してよい。`reset --hard` / force push / ブランチ削除などの破壊的操作だけは明示依頼を待つ。詳細は `.memory/agent-rules.md`。
- 承認は不要だが、release は外部公開を伴うので**公開物（release message / App Store 文面 / version 番号）の内容は作成後にユーザーへ提示する**。止めて待つのではなく、報告として出す。
- release 作業では、必ず過去 release からの差分を念入りに確認する。
- 直近 tag だけでなく、必要に応じて過去 release note、closed Issue、commit log、現在の差分を照合する。
- 変更内容は「ユーザーに見える変更」「不具合修正」「内部改善」「ドキュメント更新」に分けて整理する。
- App Store 配布を前提に、アプリ本体・App Store 文面・GitHub Release・Web サイトの説明が矛盾しないようにする。
- アプリ内の任意アップデート案内は App Store Lookup API の `version` を正とする。release ごとに `snowlog.kmchan.jp` へ更新確認用 JSON を配置・更新する運用は行わない。

## 事前確認

1. 現在の branch と作業ツリーを確認する。
2. `package.json`、`app.json`、直近 git tag、GitHub Releases から現在の version を確認する。
3. 次の version 番号をユーザーと確認する。
4. EAS の build number / app version source の扱いを確認する。
   - `eas.json` の `cli.appVersionSource` が `remote` の場合、build number は基本的に repository に明示しない。
   - `production.autoIncrement` が有効な場合、EAS 側で build number が進む前提で扱う。
   - ただし、release 前に EAS 側の次 build number は確認する。

## 過去 release との差分確認

必ず以下を確認してから release message や App Store 文面を作る。

1. 直近 tag から `HEAD` までの commit log を確認する。
2. 前回 GitHub Release の本文を確認する。
3. 前回 release 以降に close された GitHub Issues を確認する。
4. `git diff <previous-tag>..HEAD` で実際の差分を確認する。
5. `README.md`、`SnowLog.md`、`appstore/about.txt`、`pr/web` の説明と実装差分が一致しているか確認する。
6. release note に入れるべき変更と、内部変更として省略してよい変更を分ける。

## 更新対象

### アプリ version

- `app.json` の `expo.version`
- `package.json` の `version`
- `package-lock.json` の root package version

### ドキュメント

- `README.md`
  - version badge
  - App Store / 公開状況
  - ユーザー向けの主要機能説明
  - README は非技術寄りの showcase として保つ
- `SnowLog.md`
  - 対象バージョン
  - 実装仕様
  - 技術的な差分
  - platform / i18n / import / database などの仕様変更
- `appstore/about.txt`
  - App Store 用説明文
  - 今回の version の訴求に合わせた文面
- `pr/web`
  - Web サイトの訴求文
  - FAQ
  - screenshots / icon / App Store link
  - privacy policy の日本語・英語文面
  - アプリの任意アップデート確認用 JSON は管理しない

## 検証

release 前に、最低限以下を実行する。

```powershell
npx.cmd expo install --check
npm.cmd run lint
npx.cmd tsc --noEmit
```

必要に応じて以下も確認する。

```powershell
npx.cmd expo-doctor
```

`npm.ps1` / `npx.ps1` が PowerShell の実行ポリシーで失敗する場合は、`npm.cmd` / `npx.cmd` を使う。

## GitHub Release

GitHub Release を作成する前に、以下を必ず行う。

1. active Git identity と GitHub identity がユーザー本人であることを確認する。
2. `~/.codex/commit_message.md` を読み、直近 10 件の commit message を確認する。
3. release commit を作成する場合は、`[gitmoji] English message` 形式を守る。
4. tag は `vX.Y.Z` 形式にする。
5. release message は、過去 release との差分確認に基づいて英語で作成する。
6. AI agent 名や `Co-Authored-By` は commit / tag / release / Issue / PR に残さない。

## Release message の構成

GitHub Release では、以下の構成を基本にする。

```markdown
## Highlights

- ...

## Fixes

- ...

## Documentation

- ...

## Verification

- `npx.cmd expo install --check`
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
```

App Store の「このバージョンの新機能」は、日本語で短く、ユーザーに見える変更を中心にする。
内部改善だけを並べず、利用体験として何が良くなったかを明確に書く。

## 完了条件

- app / docs / App Store 文面 / Web サイト / GitHub Release の version と説明が一致している。
- 過去 release からの差分確認が release message に反映されている。
- 検証コマンドの結果がユーザーに報告されている。
- commit / tag / push / GitHub Release 作成が完了し、公開した内容がユーザーに報告されている。
