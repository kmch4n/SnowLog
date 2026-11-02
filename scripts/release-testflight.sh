#!/usr/bin/env bash
# Build the iOS app on EAS and upload it to App Store Connect for TestFlight.
#
#   bash scripts/release-testflight.sh
#
# Interactive on purpose: EAS login, Apple ID / two-factor prompts and the
# signing-credential questions all happen in this terminal. Nothing here
# submits the build for App Store review — that stays a manual step in App
# Store Connect after TestFlight verification.
#
# Steps:
#   1. Preflight: on main, clean, in sync with origin.
#   2. Gates: lint, tsc, unit tests (the same gates CI runs).
#   3. EAS login (skipped when already logged in).
#   4. Confirmation, then `eas build --profile production --auto-submit`.
#      The build number is incremented remotely by EAS (eas.json:
#      appVersionSource "remote", production.autoIncrement).

set -euo pipefail

EAS_CLI_VERSION="25.2.0"
eas() {
    npx --yes "eas-cli@${EAS_CLI_VERSION}" "$@"
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

step() {
    printf '\n\033[1;34m==> %s\033[0m\n' "$1"
}
fail() {
    printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2
    exit 1
}

step "1/4 リポジトリの状態を確認"
branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || fail "main ブランチではありません（現在: $branch）"
# EAS uploads the git tree, so uncommitted edits would silently be left out.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    git status --short --untracked-files=no
    fail "コミットされていない変更があります。コミットか退避をしてから再実行してください"
fi
git fetch --quiet origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    fail "origin/main と一致していません。git pull / git push で揃えてから再実行してください"
fi
app_version="$(node -p "require('./app.json').expo.version")"
echo "  ブランチ: main @ $(git rev-parse --short HEAD)"
echo "  バージョン: ${app_version}（build number は EAS が自動で採番）"

step "2/4 lint / 型チェック / テスト"
if [ ! -d node_modules ]; then
    npm ci
fi
npm run lint
npx tsc --noEmit
npm test
echo "  すべて成功"

step "3/4 Expo（EAS）へのログイン"
if eas whoami >/dev/null 2>&1; then
    echo "  ログイン済み: $(eas whoami 2>/dev/null | head -n 1)"
else
    echo "  Expo アカウントでログインしてください"
    eas login
fi

step "4/4 iOS 本番ビルドと TestFlight への提出"
cat <<EOF

  これから EAS のクラウドで SnowLog ${app_version} の iOS ビルドを作り、
  完了後に App Store Connect（TestFlight）へ自動で提出します。

  - ビルドには 15〜30 分ほどかかります（EAS のビルド枠を 1 回分使います）
  - 途中で Apple ID のサインイン、2 ファクタ認証、証明書や
    App Store Connect API キーについて質問されることがあります。
    特に理由がなければ、EAS に生成・管理させる選択肢で問題ありません
  - App Store の審査には提出しません（TestFlight まで）

EOF
read -r -p "  続行しますか？ [y/N] " answer
case "$answer" in
    y | Y | yes | YES) ;;
    *) fail "中止しました" ;;
esac

eas build --platform ios --profile production --auto-submit

cat <<'EOF'

==> 完了

  App Store Connect で処理が終わると（通常 10〜30 分）、TestFlight アプリに
  新しいビルドが表示されます。処理完了のメールが Apple から届きます。

  - 提出が失敗した場合は、ビルド自体は EAS に残っています。次で再提出できます:
      npx eas-cli@25.2.0 submit --platform ios --latest
  - 輸出コンプライアンスは app.json の ITSAppUsesNonExemptEncryption=false で
    回答済みなので、通常は追加の質問は出ません
EOF
