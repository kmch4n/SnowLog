#!/usr/bin/env python3
"""
雪場マスターデータを Wikidata から再取得して src/constants/skiResorts.json を更新するスクリプト。

データソース:
    - Wikidata (CC0): https://www.wikidata.org/wiki/Q130003 （スキー場）
    - 地球地図日本（国土地理院）由来の prefecture polygon: https://github.com/dataofjapan/land

使用例:
    python scripts/update_ski_resorts.py
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from math import inf
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
TARGET_PATH = REPO_ROOT / "src" / "constants" / "skiResorts.json"

# Wikidata SPARQL クエリ（日本国内のスキー場 + 位置情報 + 都道府県）
WIKIDATA_QUERY = """
SELECT ?item ?itemLabel ?itemAltLabel ?coord ?prefectureLabel ?officialName WHERE {
  ?item wdt:P31/wdt:P279* wd:Q130003;
        wdt:P17 wd:Q17;
        wdt:P625 ?coord.
  OPTIONAL {
    ?item wdt:P131* ?prefecture.
    ?prefecture wdt:P31 wd:Q50337.
  }
  OPTIONAL {
    ?item wdt:P1448 ?officialName.
    FILTER(LANG(?officialName) = 'ja')
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language 'ja,en'. }
}
""".strip()

WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"
JAPAN_GEOJSON_URL = "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson"

# 既知のブランド名更新を反映するための手動差し替え
MANUAL_RENAMES = {
    "白馬五竜スキー場": "エイブル白馬五竜",
    "北信州木島平スキー場": "スノーリゾート ロマンスの神様",
}


def http_post_json(url: str, payload: Dict[str, str]) -> Dict:
    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Accept": "application/sparql-results+json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "SnowLogDataFetcher/1.0 (+https://github.com/kmch4n/snowlog)",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_get_json(url: str) -> Dict:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "SnowLogDataFetcher/1.0 (+https://github.com/kmch4n/snowlog)",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def ring_contains(ring: List[List[float]], x: float, y: float) -> bool:
    inside = False
    n = len(ring)
    if n < 3:
        return False
    for i in range(n - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        if (y1 > y) == (y2 > y):
            continue
        denom = y2 - y1
        if denom == 0:
            continue
        xinters = (x2 - x1) * (y - y1) / denom + x1
        if xinters > x:
            inside = not inside
    return inside


def polygon_contains(poly: List[List[List[float]]], x: float, y: float) -> bool:
    if not poly or not ring_contains(poly[0], x, y):
        return False
    for hole in poly[1:]:
        if ring_contains(hole, x, y):
            return False
    return True


def build_prefectures(features: Iterable[Dict]) -> List[Dict]:
    items: List[Dict] = []
    for feat in features:
        geom = feat.get("geometry")
        props = feat.get("properties", {})
        name = props.get("nam_ja") or props.get("nam")
        if not geom or not name:
            continue
        if geom["type"] == "Polygon":
            polygons = [geom["coordinates"]]
        elif geom["type"] == "MultiPolygon":
            polygons = geom["coordinates"]
        else:
            continue
        minx = miny = inf
        maxx = maxy = -inf
        for poly in polygons:
            for ring in poly:
                for lon, lat in ring:
                    minx = min(minx, lon)
                    maxx = max(maxx, lon)
                    miny = min(miny, lat)
                    maxy = max(maxy, lat)
        items.append({"name": name, "polygons": polygons, "bbox": (minx, miny, maxx, maxy)})
    return items


def locate_prefecture(prefectures: List[Dict], lon: float, lat: float) -> str | None:
    for pref in prefectures:
        minx, miny, maxx, maxy = pref["bbox"]
        if lon < minx or lon > maxx or lat < miny or lat > maxy:
            continue
        for poly in pref["polygons"]:
            if polygon_contains(poly, lon, lat):
                return pref["name"]
    return None


def parse_point(wkt_point: str) -> Tuple[float, float]:
    inner = wkt_point.strip()[6:-1]
    lon_str, lat_str = inner.split()
    return float(lat_str), float(lon_str)


def main() -> int:
    print("Fetching Wikidata…", file=sys.stderr)
    wikidata = http_post_json(WIKIDATA_ENDPOINT, {"query": WIKIDATA_QUERY})
    bindings = wikidata["results"]["bindings"]
    print(f"  {len(bindings)} rows", file=sys.stderr)
    print("Fetching prefecture polygons…", file=sys.stderr)
    japan_geo = http_get_json(JAPAN_GEOJSON_URL)
    prefectures = build_prefectures(japan_geo["features"])
    records: Dict[str, Dict] = {}
    for row in bindings:
        label = row["itemLabel"]["value"].strip()
        official = row.get("officialName", {}).get("value", "").strip()
        raw_name = official or label
        name = raw_name.replace("\u3000", " ").strip()
        if not name or name in records:
            continue
        lat, lon = parse_point(row["coord"]["value"])
        prefecture = row.get("prefectureLabel", {}).get("value") or locate_prefecture(prefectures, lon, lat) or ""
        records[name] = {
            "prefecture": prefecture,
            "latitude": round(lat, 7),
            "longitude": round(lon, 7),
        }

    for old_name, new_name in MANUAL_RENAMES.items():
        if old_name in records:
            records[new_name] = records.pop(old_name)

    sorted_items = sorted(records.items(), key=lambda item: (item[1]["prefecture"], item[0]))
    output = [
        {
            "id": idx,
            "name": name,
            "prefecture": data["prefecture"],
            "latitude": data["latitude"],
            "longitude": data["longitude"],
        }
        for idx, (name, data) in enumerate(sorted_items, start=1)
    ]

    TARGET_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")
    print(f"Updated {TARGET_PATH} ({len(output)} resorts).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
