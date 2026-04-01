/**
 * Web用スタブ — 動画インポートはiOSのみ対応
 */
import type { ImportMetadata } from "../types";

export async function importVideo(
    _asset: unknown,
    _metadata: ImportMetadata,
    _options: { sourceUri: string }
): Promise<string> {
    throw new Error("動画のインポートはiOSアプリでのみ利用できます。");
}
