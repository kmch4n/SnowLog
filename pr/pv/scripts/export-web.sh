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

# The landing page serves the film at full resolution. CRF 30 rather than the
# 31 the 720p copy used: the same setting costs less perceptually when it has
# four times the pixels to spend it on, and the captions are what suffer first.
#
# This is not the master. The master is CRF 16 for archival and YouTube, and at
# ~98 MB it has no business in a git repository or on a web page -- a visitor
# who presses play would pull it down over a range request either way, but every
# re-export would also add another 98 MB to the history permanently.
CRF=30

# Well past the scene's entrance animation, so the poster shows the logo and
# tagline settled rather than mid-flight. S3 runs 20.0s to 28.0s.
POSTER_AT=25

# What the finished film should measure. The narration files are normalised to
# -14 LUFS individually, but they are mono and Remotion puts the same signal in
# both channels -- and BS.1770 sums channel energies, so the film came out
# 3.01 dB hotter than the voice going into it, at about -11.8 LUFS. Nothing
# clips (the peak sits at -1.5 dBFS), but content that far above the streaming
# reference is enough to push a laptop or phone speaker into distortion, which
# is heard as the audio breaking up rather than as it being loud.
FILM_LUFS=-14
FILM_PEAK=-1.5

if [[ ! -f "$MASTER" ]]; then
    echo "no master at $MASTER -- render it first" >&2
    exit 1
fi

mkdir -p "$WEB"

# Bring the master to the target before anything is derived from it. Two passes,
# with the video stream copied rather than re-encoded, so this costs nothing in
# picture quality and one pass cannot drift the gain around mid-film.
# Split on the quotes rather than stripping whitespace: ffmpeg indents the report
# with tabs, and an earlier version that only stripped spaces parsed every field
# as empty and then handed "" to the filter.
read -r in_i in_tp in_lra in_thresh offset < <(
    ffmpeg -hide_banner -i "$MASTER" \
        -af "loudnorm=I=$FILM_LUFS:TP=$FILM_PEAK:LRA=11:print_format=json" \
        -f null - 2>&1 |
        awk -F'"' '
            $2 == "input_i" {i = $4}
            $2 == "input_tp" {tp = $4}
            $2 == "input_lra" {lra = $4}
            $2 == "input_thresh" {th = $4}
            $2 == "target_offset" {off = $4}
            END {print i, tp, lra, th, off}'
)

if [[ -z "$in_i" || -z "$offset" ]]; then
    echo "could not read the master's loudness from ffmpeg" >&2
    exit 1
fi

# Skip when it is already there. This rewrites the master in place, and the
# audio has to be re-encoded to do it, so running the script twice would put the
# film through AAC a second time for no gain.
if awk -v i="$in_i" -v t="$FILM_LUFS" 'BEGIN{exit !(i - t < 0.5 && t - i < 0.5)}'; then
    printf 'master already measures %s LUFS, left alone\n' "$in_i"
else
    printf 'master measured %s LUFS, bringing it to %s\n' "$in_i" "$FILM_LUFS"
    ffmpeg -y -loglevel error -i "$MASTER" -c:v copy \
        -af "loudnorm=I=$FILM_LUFS:TP=$FILM_PEAK:LRA=11:measured_I=$in_i:measured_TP=$in_tp:measured_LRA=$in_lra:measured_thresh=$in_thresh:offset=$offset:linear=true" \
        -c:a aac -b:a 256k -movflags +faststart \
        "$MASTER.levelled.mp4"
    mv -f "$MASTER.levelled.mp4" "$MASTER"
fi

# No scale filter: the master is already 1920x1080, so re-encoding at the same
# size avoids a resample the picture would only lose from.
ffmpeg -y -loglevel error -i "$MASTER" \
    -c:v libx264 -crf "$CRF" -preset slow -pix_fmt yuv420p \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    "$WEB/snowlog-pv-1080p.mp4"

ffmpeg -y -loglevel error -ss "$POSTER_AT" -i "$MASTER" -frames:v 1 \
    -q:v 3 \
    "$WEB/snowlog-pv-poster.jpg"

# The 720p copy the page used before. Left behind by an older run it would sit
# in the repository unreferenced, so clear it out rather than trusting whoever
# reads the diff to notice.
rm -f "$WEB/snowlog-pv-720p.mp4"

duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MASTER")
printf '\nmaster   %s  %.2fs\n' "$MASTER" "$duration"
for file in "$WEB/snowlog-pv-1080p.mp4" "$WEB/snowlog-pv-poster.jpg"; do
    printf '%-46s %s\n' "$(basename "$file")" "$(du -h "$file" | cut -f1)"
done
printf '\nRuntime: %dm%02ds\n' \
    "$(awk -v d="$duration" 'BEGIN{printf "%d", d/60}')" \
    "$(awk -v d="$duration" 'BEGIN{printf "%d", d%60}')"
