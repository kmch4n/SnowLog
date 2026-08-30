/**
 * Web用スタブ — expo-document-picker / expo-file-system / expo-sqlite は
 * ブラウザ非対応。
 *
 * ここは `exportService.web.ts` と違って **throw する**。あちらは `Alert` を
 * 出してから正常終了するため、設定画面の catch を素通りして
 * `hapticSuccess()` が焚かれ、何もしていないのに成功したように見える。
 * `ImportError` を投げれば既存の catch がそのまま正直な失敗として扱える。
 */
import { ImportError } from "./importPayload";
import type { ImportPlan } from "./importPayload";

export interface ImportPreview {
    plan: ImportPlan;
    counts: {
        videos: number;
        tags: number;
        diaryEntries: number;
        techniqueOptions: number;
        favoriteResorts: number;
    };
}

export interface ImportSummary {
    videos: number;
    videosSkipped: number;
    tags: number;
    diaryEntries: number;
    techniqueOptions: number;
    favoriteResorts: number;
    preferences: number;
    unavailableVideos: number;
    tagFailures: number;
}

export async function pickAndParseBackup(): Promise<ImportPreview | null> {
    throw new ImportError("webUnsupported");
}

export async function applyImportPlan(_plan: ImportPlan): Promise<ImportSummary> {
    throw new ImportError("webUnsupported");
}
