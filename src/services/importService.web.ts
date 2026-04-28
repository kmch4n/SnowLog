/**
 * Web用スタブ — 動画インポートはiOSのみ対応
 */
import type { ImportMetadata } from "../types";
import { t } from "../i18n";

export async function importVideo(
    _asset: unknown,
    _metadata: ImportMetadata,
    _options: { sourceUri: string }
): Promise<string> {
    throw new Error(t("import.webUnsupportedBody"));
}
