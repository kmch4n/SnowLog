#!/usr/bin/env bash
# Build one test clip per location-writing method, all for Hakuba
# (+36.6983 +137.8320, 700 m). Each variant gets a distinct capture minute so
# it can be told apart in Photos.sqlite even if file names are lost.
#
#   bash build_variants.sh SRC.mov OUTDIR
#
# Steps whose tool is missing (ffmpeg, exiftool, swift) are skipped with a note.
# On the macOS runner: `brew install exiftool` (ffmpeg optional, see README).
set -u
SRC=${1:?source .mov}
OUT=${2:?output dir}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"
LAT=36.6983 LON=137.8320 ALT=700
ISO="+36.6983+137.8320+700.000/"
have() { command -v "$1" > /dev/null 2>&1; }

# Clean base: same samples, no metadata except the mvhd creation time.
if have ffmpeg; then
    ffmpeg -hide_banner -loglevel error -y -i "$SRC" -map 0 -c copy -map_metadata -1 \
        -metadata creation_time=2026-11-07T01:00:00Z "$OUT/base_clean.mov"

    # V1 (control for issue approach 1): ffmpeg mdta keys with altitude -> moov/udta/meta.
    ffmpeg -hide_banner -loglevel error -y -i "$OUT/base_clean.mov" -map 0 -c copy \
        -movflags use_metadata_tags -map_metadata -1 \
        -metadata "com.apple.quicktime.location.ISO6709=$ISO" \
        -metadata "com.apple.quicktime.creationdate=2026-11-07T10:01:00+0900" \
        -metadata creation_time=2026-11-07T01:01:00Z \
        "$OUT/gps_ffmpeg_mdta_alt.mov"

    # V2: ffmpeg plain MOV mode -> classic QuickTime user data udta/(c)xyz.
    ffmpeg -hide_banner -loglevel error -y -i "$OUT/base_clean.mov" -map 0 -c copy \
        -map_metadata -1 -metadata "location=$ISO" \
        -metadata creation_time=2026-11-07T01:02:00Z \
        "$OUT/gps_ffmpeg_xyz_alt.mov"
else
    echo "skip ffmpeg variants (no ffmpeg); expecting $OUT/base_clean.mov to exist"
fi

if [ -f "$OUT/base_clean.mov" ]; then
    # V3: iPhone-style moov/meta (mdta keys) written by a byte-level injector.
    python3 -I "$HERE/inject_moov_meta.py" "$OUT/base_clean.mov" "$OUT/gps_py_moovmeta.mov" \
        --drop-udta --iso6709 "$ISO" --accuracy 5.000000 \
        --creationdate 2026-11-07T10:03:00+0900
    # V4: same plus udta/(c)xyz and make/model/software keys.
    python3 -I "$HERE/inject_moov_meta.py" "$OUT/base_clean.mov" "$OUT/gps_py_moovmeta_xyz_dev.mov" \
        --drop-udta --xyz --device-keys --iso6709 "$ISO" --accuracy 5.000000 \
        --creationdate 2026-11-07T10:04:00+0900
fi

if have exiftool && [ -f "$OUT/base_clean.mov" ]; then
    # V5: ExifTool Keys (moov/meta) only.
    cp "$OUT/base_clean.mov" "$OUT/gps_exiftool_keys.mov"
    exiftool -m -P -q -overwrite_original \
        "-Keys:GPSCoordinates=$LAT, $LON, $ALT" \
        "-Keys:CreationDate=2026:11:07 10:05:00+09:00" \
        "$OUT/gps_exiftool_keys.mov"
    # V6: ExifTool Keys + UserData (c)xyz.
    cp "$OUT/base_clean.mov" "$OUT/gps_exiftool_both.mov"
    exiftool -m -P -q -overwrite_original \
        "-Keys:GPSCoordinates=$LAT, $LON, $ALT" \
        "-UserData:GPSCoordinates=$LAT, $LON, $ALT" \
        "-Keys:CreationDate=2026:11:07 10:06:00+09:00" \
        "$OUT/gps_exiftool_both.mov"
    exiftool -G1 -a -s -GPS* -CreationDate "$OUT"/gps_exiftool_*.mov
else
    echo "skip exiftool variants"
fi

if have swift && [ "$(uname)" = Darwin ] && [ -f "$OUT/base_clean.mov" ]; then
    # V7: AVFoundation passthrough re-export, the way the Camera app's files look.
    swift "$HERE/gps_video.swift" "$OUT/base_clean.mov" "$OUT/gps_swift_export.mov" \
        "$LAT" "$LON" "$ALT" 2026-11-07T10:07:00+0900
    # V8: same with make/model/software keys.
    GPS_DEVICE_KEYS=1 swift "$HERE/gps_video.swift" "$OUT/base_clean.mov" \
        "$OUT/gps_swift_export_dev.mov" "$LAT" "$LON" "$ALT" 2026-11-07T10:08:00+0900
    # What AVFoundation itself reads from every variant (Photos uses AVFoundation).
    swift "$HERE/gps_video.swift" --dump "$OUT"/gps_*.mov "$SRC"
else
    echo "skip swift variants"
fi

ls -l "$OUT"
