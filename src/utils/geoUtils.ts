import SKI_RESORTS_RAW from "@/constants/skiResorts.json";
import type { SkiResort } from "@/types";

const SKI_RESORTS = SKI_RESORTS_RAW as SkiResort[];

/**
 * Haversine 公式で2点間の距離（km）を計算する
 */
export function haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * GPS座標から近いスキー場を距離順で返す
 * @param lat 緯度（十進数）
 * @param lon 経度（十進数）
 * @param thresholdKm この距離（km）以内を対象にする（デフォルト 30km）
 * @param maxResults 最大返却件数（デフォルト 5件）
 */
export function findNearbySkiResorts(
    lat: number,
    lon: number,
    thresholdKm = 30,
    maxResults = 5
): { name: string; distanceKm: number }[] {
    const results: { name: string; distanceKm: number }[] = [];

    for (const resort of SKI_RESORTS) {
        if (resort.latitude == null || resort.longitude == null) continue;
        const d = haversineKm(lat, lon, resort.latitude, resort.longitude);
        if (d <= thresholdKm) {
            results.push({ name: resort.name, distanceKm: d });
        }
    }

    return results.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, maxResults);
}
