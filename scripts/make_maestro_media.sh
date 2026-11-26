#!/usr/bin/env bash
# Rebuilds the iOS simulator test videos in .maestro/media/ (#98).
#
# Each clip keeps its frames and gets only iPhone-style QuickTime metadata: the
# capture date and, for the two runs, the location. ffmpeg strips what was there;
# scripts/write_quicktime_metadata.py writes moov/meta the way the Camera app does,
# which is what the simulator's Photos library reads (ffmpeg's own metadata tags
# are ignored, so the clips used to arrive without a location).
#
#   bash scripts/make_maestro_media.sh      # needs ffmpeg and python3
set -euo pipefail
cd "$(dirname "$0")/.."
media=.maestro/media
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# name | capture date (local, with offset) | mvhd time (UTC) | ISO 6709 location or empty
while IFS='|' read -r name date utc location; do
    ffmpeg -nostdin -hide_banner -loglevel error -y -i "$media/$name.mov" -map 0 -c copy \
        -map_metadata -1 -metadata creation_time="$utc" "$tmp/$name.mov"
    args=(--drop-udta --creationdate "$date")
    if [ -n "$location" ]; then
        args+=(--iso6709 "$location" --accuracy 5.000000)
    fi
    python3 -I scripts/write_quicktime_metadata.py "$tmp/$name.mov" "$media/$name.mov" "${args[@]}"
done <<'LIST'
hakuba_run|2026-11-07T10:15:00+0900|2026-11-07T01:15:00Z|+36.6983+137.8320+800.000/
zao_run|2026-10-31T11:30:00+0900|2026-10-31T02:30:00Z|+38.1690+140.4210+900.000/
no_gps|2026-11-14T14:00:00+0900|2026-11-14T05:00:00Z|
LIST
