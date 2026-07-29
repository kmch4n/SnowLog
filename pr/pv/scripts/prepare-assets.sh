#!/usr/bin/env bash
# Copies raw footage from .temp/ into pr/pv/public/ under stable names
# and extracts still frames for the S2 grid. Safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SRC="$ROOT/.temp"
DEST="$ROOT/pr/pv/public"

mkdir -p "$DEST/footage" "$DEST/screen" "$DEST/grid" "$DEST/brand" \
         "$DEST/audio/narration"

# The hero footage is 4K HEVC at 59.94fps with an audio track. Transcode it
# rather than copying: headless Chrome cannot be relied on to decode HEVC, the
# composition is 60fps, and the film carries its own narration so the camera
# audio must go.
#
# The crop drops the bottom strip, which carries a burned-in "Insta360 Ace Pro 2"
# watermark — the only non-SnowLog brand mark that would otherwise appear in the
# film. 3072x1728 is 16:9, and the window sits above the watermark at y=1872.
# Even after cropping, 3072px still downsamples to 1920px, so the result is
# supersampled rather than upscaled.
ffmpeg -y -loglevel error -i "$SRC/滑走動画.mov" \
    -vf "crop=3072:1728:384:100,scale=1920:1080:flags=lanczos" \
    -r 60 -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p \
    -an -movflags +faststart \
    "$DEST/footage/run.mp4"

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
