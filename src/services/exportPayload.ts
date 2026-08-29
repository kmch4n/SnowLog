/**
 * Pure builder for the backup payload.
 *
 * Split out of `exportService.ts` so it can be tested: that module imports
 * expo-file-system / expo-sharing / expo-constants at load time and cannot be
 * compiled by `scripts/tests/`. Keep every import here relative and every
 * schema import type-only — a value import of `../database/schema` would drag
 * `drizzle-orm` into the emit and break the test recipe. See
 * `.memory/testing.md`.
 *
 * `ExportError` lives here rather than beside the code that throws it because
 * this module has no `.web` twin, so both platforms share one class. Declaring
 * it in `exportService.ts` would force `exportService.web.ts` to re-declare it,
 * which is exactly the shim drift #74 catalogues — and the `grep`-based pair
 * check cannot see a class.
 */
import type {
    AppPreferenceSelect,
    DiaryEntrySelect,
    TechniqueOptionSelect,
    VideoSelect,
} from "../database/schema";
import type { Tag } from "../types";
import { parseTechniques } from "../utils/parseTechniques";

/** Bump when the export payload shape changes. */
export const EXPORT_SCHEMA_VERSION = 1;

/**
 * A failure whose message is safe to show the user verbatim. Anything else
 * that escapes `exportAllToJSON` is internal and must not be displayed.
 */
export class ExportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ExportError";
    }
}

export interface ExportedVideo {
    id: string;
    assetId: string;
    filename: string;
    thumbnailUri: string;
    duration: number;
    capturedAt: number;
    skiResortName: string | null;
    memo: string;
    title: string | null;
    techniques: string[] | null;
    isFileAvailable: boolean;
    isFavorite: boolean;
    createdAt: number;
    updatedAt: number;
    tags: Tag[];
}

export interface ExportedDiaryEntry {
    dateKey: string;
    skiResortName: string | null;
    weather: string | null;
    snowCondition: string | null;
    impressions: string;
    temperature: number | null;
    companions: string | null;
    fatigueLevel: number | null;
    expenses: number | null;
    numberOfRuns: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface ExportPayload {
    schemaVersion: number;
    appVersion: string;
    exportedAt: string;
    videos: ExportedVideo[];
    tags: Tag[];
    techniqueOptions: { name: string; sortOrder: number }[];
    /** Names, matching what `getFavoriteResorts()` returns and what v1 ships. */
    favoriteResorts: string[];
    diaryEntries: ExportedDiaryEntry[];
    preferences: { key: string; value: string }[];
}

export interface ExportSource {
    videos: VideoSelect[];
    /** A missing or empty entry means the video has no tags. */
    tagsByVideoId: Map<string, Tag[]>;
    allTags: Tag[];
    techniqueOptions: TechniqueOptionSelect[];
    favoriteResorts: string[];
    diaryEntries: DiaryEntrySelect[];
    preferences: AppPreferenceSelect[];
    appVersion: string;
    /** ISO 8601. Injected rather than read from the clock so tests are stable. */
    exportedAt: string;
}

/**
 * Map database rows to the backup JSON.
 *
 * Fields are listed explicitly rather than spread, so a column added to any
 * table later cannot silently widen the backup format without a schema version
 * bump. `scripts/tests/exportPayload.test.cjs` pins the key sets.
 *
 * `preferences` is dumped verbatim, including the migration bookmarks
 * (`thumbnail_migration_version`, `capturedAt_repair_version`). A backup should
 * be complete; deciding what may be written back is the importer's job, and it
 * needs a whitelist — restoring a migration bookmark onto a fresh install would
 * skip the migration it guards.
 */
export function buildExportPayload(source: ExportSource): ExportPayload {
    return {
        schemaVersion: EXPORT_SCHEMA_VERSION,
        appVersion: source.appVersion,
        exportedAt: source.exportedAt,
        videos: source.videos.map((video) => ({
            id: video.id,
            assetId: video.assetId,
            filename: video.filename,
            thumbnailUri: video.thumbnailUri,
            duration: video.duration,
            capturedAt: video.capturedAt,
            skiResortName: video.skiResortName,
            memo: video.memo,
            title: video.title,
            techniques: parseTechniques(video.techniques),
            isFileAvailable: video.isFileAvailable === 1,
            isFavorite: video.isFavorite === 1,
            createdAt: video.createdAt,
            updatedAt: video.updatedAt,
            tags: (source.tagsByVideoId.get(video.id) ?? []).map((tag) => ({
                id: tag.id,
                name: tag.name,
                type: tag.type,
            })),
        })),
        tags: source.allTags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            type: tag.type,
        })),
        techniqueOptions: source.techniqueOptions.map((option) => ({
            name: option.name,
            sortOrder: option.sortOrder,
        })),
        favoriteResorts: source.favoriteResorts,
        diaryEntries: source.diaryEntries.map((entry) => ({
            dateKey: entry.dateKey,
            skiResortName: entry.skiResortName,
            weather: entry.weather,
            snowCondition: entry.snowCondition,
            impressions: entry.impressions,
            temperature: entry.temperature,
            companions: entry.companions,
            fatigueLevel: entry.fatigueLevel,
            expenses: entry.expenses,
            numberOfRuns: entry.numberOfRuns,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        })),
        preferences: source.preferences.map((preference) => ({
            key: preference.key,
            value: preference.value,
        })),
    };
}

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

/**
 * `snowlog-backup-20260115-0905.json`.
 *
 * Local time on purpose: the name is read by a human in the Files app, on the
 * device that produced it. Built from `getFullYear()`-family getters, so the
 * output depends on the passed `Date`, not on the runner's `TZ`.
 */
export function backupFileName(now: Date): string {
    const stamp =
        `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
        `-${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `snowlog-backup-${stamp}.json`;
}
