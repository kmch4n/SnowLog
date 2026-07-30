#!/usr/bin/env bash
# Builds the landing page's copies of the film from the 1080p master.
#
#   bash pr/pv/scripts/export-web.sh
#
# Render the master first:
#   cd pr/pv && npx remotion render SnowLogPv out/snowlog-pv.mp4
#
# This was done by hand four times before it was written down, which is how the
# encoder settings stopped being reproducible -- the size budget was met by
# guessing at CRF each time. They live here now.
#
# The 1080p master is the one to upload to YouTube. It is not committed; only
# these two derived files are, because the landing page serves them directly.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MASTER="$HERE/../out/snowlog-pv.mp4"
WEB="$HERE/../../web/public/videos"

# CRF 31 at 720p. High enough to keep the file inside the budget for a
# landing page that autoplays nothing and is fetched with preload="none";
# low enough that the captions stay crisp, which is what suffers first.
CRF=31

# Well past the scene's entrance animation, so the poster shows the logo and
# tagline settled rather than mid-flight. S3 runs 20.0s to 28.0s.
POSTER_AT=25

if [[ ! -f "$MASTER" ]]; then
    echo "no master at $MASTER -- render it first" >&2
    exit 1
fi

mkdir -p "$WEB"

ffmpeg -y -loglevel error -i "$MASTER" \
    -vf "scale=1280:720:flags=lanczos" \
    -c:v libx264 -crf "$CRF" -preset slow -pix_fmt yuv420p \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    "$WEB/snowlog-pv-720p.mp4"

ffmpeg -y -loglevel error -ss "$POSTER_AT" -i "$MASTER" -frames:v 1 \
    -vf "scale=1280:720:flags=lanczos" -q:v 3 \
    "$WEB/snowlog-pv-poster.jpg"

duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MASTER")
printf '\nmaster   %s  %.2fs\n' "$MASTER" "$duration"
for file in "$WEB/snowlog-pv-720p.mp4" "$WEB/snowlog-pv-poster.jpg"; do
    printf '%-46s %s\n' "$(basename "$file")" "$(du -h "$file" | cut -f1)"
done
printf '\nRuntime for pr/web/src/content.ts: %dm%02ds\n' \
    "$(awk -v d="$duration" 'BEGIN{printf "%d", d/60}')" \
    "$(awk -v d="$duration" 'BEGIN{printf "%d", d%60}')"
