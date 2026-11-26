#!/usr/bin/env bash
# Add every variant to a booted simulator and print what Photos stored.
#
#   bash probe_sim.sh UDID DIR [OUTFILE]
#
# Expected for a working variant: ZLATITUDE ~36.6983, ZLONGITUDE ~137.832.
# The capture minute (10:0N JST) identifies the variant if ZORIGINALFILENAME is
# empty; for py/exiftool/swift variants a 10:00 date (the mvhd time) instead of
# 10:0N also shows that Photos did not read moov/meta at all.
set -u
UDID=${1:?udid}
DIR=${2:?variant dir}
OUTFILE=${3:-/dev/stdout}
DB="$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Media/PhotoData/Photos.sqlite"

files=("$DIR"/gps_*.mov)
before=$(sqlite3 "$DB" "SELECT COUNT(*) FROM ZASSET WHERE ZKIND = 1;" 2> /dev/null || echo 0)
xcrun simctl addmedia "$UDID" "${files[@]}"

# Wait for assetsd to finish importing (up to 60 s) instead of a fixed sleep.
want=$((before + ${#files[@]}))
for _ in $(seq 1 30); do
    n=$(sqlite3 "$DB" "SELECT COUNT(*) FROM ZASSET WHERE ZKIND = 1;" 2> /dev/null || echo 0)
    [ "$n" -ge "$want" ] && break
    sleep 2
done
sleep 10  # let any deferred metadata pass land

{
    echo "--- ZASSET joined with original file names"
    sqlite3 -header "$DB" "
        SELECT aa.ZORIGINALFILENAME, a.ZFILENAME, a.ZLATITUDE, a.ZLONGITUDE,
               datetime(a.ZDATECREATED + 978307200, 'unixepoch', '+9 hours') AS jst
        FROM ZASSET a LEFT JOIN ZADDITIONALASSETATTRIBUTES aa ON aa.ZASSET = a.Z_PK
        ORDER BY jst;" \
    || sqlite3 -header "$DB" "
        SELECT ZFILENAME, ZLATITUDE, ZLONGITUDE,
               datetime(ZDATECREATED + 978307200, 'unixepoch', '+9 hours') AS jst
        FROM ZASSET ORDER BY jst;"
} | tee "$OUTFILE"
