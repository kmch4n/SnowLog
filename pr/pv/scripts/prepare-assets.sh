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
    -r 60 -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
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

# Apple's official device bezel, from the Product Bezels section of
# developer.apple.com/design/resources. Licensed for marketing your own app;
# it lives in .temp/ and public/, both untracked, and must not be committed.
cp "$SRC/iPhone 17 Pro - Deep Blue - Portrait.png"       "$DEST/brand/device-frame.png"

# The screen cutout, derived from the bezel's own alpha. Apple's screen corners
# are squircles, so this is the only way to clip the recording to them exactly.
python "$(dirname "$0")/make-screen-mask.py" \
    "$DEST/brand/device-frame.png" "$DEST/brand/device-screen-mask.png"

# Tiles for the S2 grid. The photos come from .temp/ like every other raw
# asset, so public/grid/ is purely generated -- drop replacements in .temp/ and
# re-run rather than hand-placing files here.
rm -f "$DEST"/grid/frame-*.jpg

tile_index=1
for photo in "$SRC"/S__*.jpg; do
    [ -e "$photo" ] || continue
    ffmpeg -y -loglevel error -i "$photo" -vf "scale=540:-1" -q:v 3 \
        "$(printf '%s/grid/frame-%02d.jpg' "$DEST" "$tile_index")"
    tile_index=$((tile_index + 1))
done

# One tile from the opening run, so the grid reads as "your own footage" rather
# than a stock set the viewer has not seen before.
ffmpeg -y -loglevel error -ss 5 -i "$DEST/footage/run.mp4" -frames:v 1 \
    -vf "scale=540:-1" -q:v 3 \
    "$(printf '%s/grid/frame-%02d.jpg' "$DEST" "$tile_index")"

TILE_COUNT="$(find "$DEST/grid" -name 'frame-*.jpg' | wc -l)"
if [ "$TILE_COUNT" -eq 0 ]; then
    echo "ERROR: no tiles found in $DEST/grid" >&2
    exit 1
fi

echo "Assets prepared in $DEST"
echo "grid/ holds $TILE_COUNT tiles — GRID_FRAME_COUNT in src/script.ts must match"
