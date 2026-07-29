#!/usr/bin/env bash
# Copies raw footage from .temp/ into pr/pv/public/ under stable names
# and extracts still frames for the S2 grid. Safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SRC="$ROOT/.temp"
DEST="$ROOT/pr/pv/public"

mkdir -p "$DEST/footage" "$DEST/screen" "$DEST/grid" "$DEST/brand" \
         "$DEST/audio/narration"

cp "$SRC/滑走動画.MP4"                                   "$DEST/footage/run.mp4"
cp "$SRC/ホーム→インポート→まとめてインポート.MP4"        "$DEST/screen/import-01.mp4"
cp "$SRC/ビデオを選択→読み込みへ.MP4"                     "$DEST/screen/import-02.mp4"
cp "$SRC/読み込み→スキー場サジェスト.MP4"                 "$DEST/screen/import-03.mp4"
cp "$SRC/動画詳細→動画選択してタイトル、スキー場など入力.MP4" "$DEST/screen/detail.mp4"
cp "$SRC/カレンダー→日付詳細→日記を選択する.MP4"           "$DEST/screen/calendar.mp4"
cp "$SRC/日記を入力.MP4"                                 "$DEST/screen/diary.mp4"
cp "$SRC/ホーム→ダッシュボードに飛ぶ ダッシュボードをスクロール.MP4" "$DEST/screen/dashboard.mp4"

cp "$ROOT/assets/images/icon.png"                        "$DEST/brand/icon.png"
cp "$ROOT/pr/web/public/images/app-store-badge.svg"      "$DEST/brand/app-store-badge.svg"

# 15 stills evenly spaced across the 7.7s run footage, for the S2 grid.
ffmpeg -y -loglevel error -i "$DEST/footage/run.mp4" \
    -vf "fps=2,scale=540:-1" -frames:v 15 -q:v 3 \
    "$DEST/grid/frame-%02d.jpg"

echo "Assets prepared in $DEST"
