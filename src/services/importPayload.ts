/**
 * Pure parser for a backup produced by `exportAllToJSON`.
 *
 * Kept free of native imports, with relative and type-only schema imports, so
 * `scripts/tests/` can compile and call it — the same constraint as
 * `exportPayload.ts`. See `.memory/testing.md`.
 *
 * Everything here treats its input as hostile: the file came off disk and may
 * be truncated, hand-edited, or from another app entirely. Structural damage
 * is fatal; a single unreadable row costs that row and is counted, so one bad
 * video cannot deny the user the rest of their log.
 */
import type { TagType } from "../types";
import { isSyntheticAssetId } from "../utils/assetId";
import { buildManagedVideoPath, validateManagedVideoPath } from "../utils/managedVideoPath";
import { isVideoStorageMode, type VideoStorageMode } from "../utils/videoStorageMode";

/**
 * The payload shapes this build knows how to read.
 *
 * v1 has no storage mode, so it is inferred: a synthetic assetId meant a
 * managed copy back then, which is exactly what the in-app migration derives
 * (#86 section 8). v2 carries the mode and the relative path explicitly.
 *
 * A version outside this list is refused rather than guessed at.
 */
export const IMPORT_SUPPORTED_SCHEMA_VERSIONS = [1, 2] as const;

/**
 * Preferences that describe the user rather than the device.
 *
 * Everything else in `app_preferences` must not travel. `thumbnail_migration_version`
 * and `capturedAt_repair_version` are migration bookmarks — writing one onto a
 * fresh install would make the app skip the migration it guards — and
 * `dismissed_update_prompt_version` is about a prompt on the old device. See #72.
 */
export const RESTORABLE_PREFERENCE_KEYS = ["home_sort_order", "weekStartDay"] as const;

const TAG_TYPES: readonly TagType[] = ["technique", "skier", "custom"];

/**
 * Why a file was refused. A **code**, not a sentence: this module cannot reach
 * i18n — importing `../i18n` would pull in `expo-localization` and stop
 * `scripts/tests/` from compiling it — so the caller looks the wording up under
 * `settings.import.errors.<code>`.
 */
export type ImportErrorCode =
    | "notBackup"
    | "newerVersion"
    | "readFailed"
    | "writeFailed"
    | "webUnsupported";

/** A refusal the UI can explain. Carries a code so the copy stays localised. */
export class ImportError extends Error {
    readonly code: ImportErrorCode;

    constructor(code: ImportErrorCode) {
        super(code);
        this.code = code;
        this.name = "ImportError";
    }
}

export interface ImportableTag {
    name: string;
    type: TagType;
}

export interface ImportableVideo {
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
    isFileAvailable: number;
    isFavorite: number;
    /** Explicit in v2, inferred from the assetId in v1. */
    storageMode: VideoStorageMode;
    /** Relative `videos/<id>.<ext>` for a copy, null otherwise. Never absolute. */
    managedVideoPath: string | null;
    createdAt: number;
    updatedAt: number;
    /** Resolved against the local database by name and type, never by stored id. */
    tagRefs: ImportableTag[];
}

export interface ImportableDiaryEntry {
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

export interface ImportSkipCounts {
    videos: number;
    tags: number;
    techniqueOptions: number;
    favoriteResorts: number;
    diaryEntries: number;
}

export interface ImportPlan {
    appVersion: string;
    exportedAt: string;
    videos: ImportableVideo[];
    /**
     * The backup's top-level tag list, which includes tags attached to no
     * video. Those exist — the tag-management screen creates custom tags with
     * no video involved — and are lost if only per-video tags are restored.
     */
    tags: ImportableTag[];
    techniqueOptions: { name: string; sortOrder: number }[];
    favoriteResorts: string[];
    diaryEntries: ImportableDiaryEntry[];
    preferences: { key: string; value: string }[];
    /** Rows that failed validation, so the UI can report them honestly. */
    skipped: ImportSkipCounts;
}

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function requiredString(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function requiredNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Missing counts as 0, matching the columns' NOT NULL DEFAULT 0. */
function numberOrZero(value: unknown): number {
    return optionalNumber(value) ?? 0;
}

/** Missing counts as "", matching `videos.memo`'s NOT NULL DEFAULT "". */
function stringOrEmpty(value: unknown): string {
    return optionalString(value) ?? "";
}

function asTagType(value: unknown): TagType | null {
    return TAG_TYPES.includes(value as TagType) ? (value as TagType) : null;
}

function parseTagRef(value: unknown): ImportableTag | null {
    if (!isRow(value)) return null;
    const name = requiredString(value.name);
    const type = asTagType(value.type);
    if (name == null || type == null) return null;
    return { name, type };
}

/**
 * Resolve the storage mode and its path, or `null` to skip the row.
 *
 * A row is refused, never repaired, when the two disagree: a `reference` that
 * claims a file, a `copy` whose path belongs to another video, a path that
 * escapes the managed directory or names a remote resource. Repairing would
 * mean guessing which half of a self-contradictory record is true, and the
 * wrong guess attaches one video's bytes to another video's metadata.
 */
function parseStorage(
    value: Row,
    schemaVersion: number,
    id: string,
    assetId: string,
    filename: string
): { storageMode: VideoStorageMode; managedVideoPath: string | null } | null {
    if (schemaVersion < 2) {
        // v1 predates the column. A synthetic assetId was the only way a row
        // could own a file, so it is the only thing that can imply `copy`.
        if (!isSyntheticAssetId(assetId)) {
            return { storageMode: "reference", managedVideoPath: null };
        }
        return { storageMode: "copy", managedVideoPath: buildManagedVideoPath(id, filename) };
    }

    if (!isVideoStorageMode(value.storageMode)) return null;
    const storageMode = value.storageMode;
    const rawPath = value.managedVideoPath;

    if (storageMode === "reference") {
        // A reference owns nothing, and a synthetic reference cannot exist:
        // there is no Photos asset behind a synthetic id to refer to.
        if (rawPath != null) return null;
        if (isSyntheticAssetId(assetId)) return null;
        return { storageMode, managedVideoPath: null };
    }

    // A copy may legitimately carry no path — an explicitly unavailable record
    // whose id was never safe to use as a filename.
    if (rawPath == null) return { storageMode, managedVideoPath: null };
    if (typeof rawPath !== "string") return null;
    if (!validateManagedVideoPath(rawPath, id)) return null;
    return { storageMode, managedVideoPath: rawPath };
}

function parseVideo(value: unknown, schemaVersion: number): ImportableVideo | null {
    if (!isRow(value)) return null;

    const id = requiredString(value.id);
    const assetId = requiredString(value.assetId);
    const filename = requiredString(value.filename);
    const capturedAt = requiredNumber(value.capturedAt);
    if (id == null || assetId == null || filename == null || capturedAt == null) {
        return null;
    }

    const storage = parseStorage(value, schemaVersion, id, assetId, filename);
    if (storage == null) return null;

    const techniques = Array.isArray(value.techniques)
        ? value.techniques.filter((item): item is string => typeof item === "string")
        : null;

    return {
        id,
        assetId,
        filename,
        thumbnailUri: stringOrEmpty(value.thumbnailUri),
        duration: numberOrZero(value.duration),
        capturedAt,
        skiResortName: optionalString(value.skiResortName),
        memo: stringOrEmpty(value.memo),
        title: optionalString(value.title),
        techniques: techniques != null && techniques.length > 0 ? techniques : null,
        isFileAvailable: value.isFileAvailable === true ? 1 : 0,
        isFavorite: value.isFavorite === true ? 1 : 0,
        storageMode: storage.storageMode,
        managedVideoPath: storage.managedVideoPath,
        createdAt: numberOrZero(value.createdAt),
        updatedAt: numberOrZero(value.updatedAt),
        tagRefs: asArray(value.tags)
            .map(parseTagRef)
            .filter((tag): tag is ImportableTag => tag != null),
    };
}

function parseTechniqueOption(
    value: unknown
): { name: string; sortOrder: number } | null {
    if (!isRow(value)) return null;
    const name = requiredString(value.name);
    const sortOrder = requiredNumber(value.sortOrder);
    if (name == null || sortOrder == null) return null;
    return { name, sortOrder };
}

function parseDiaryEntry(value: unknown): ImportableDiaryEntry | null {
    if (!isRow(value)) return null;
    const dateKey = requiredString(value.dateKey);
    if (dateKey == null) return null;

    return {
        dateKey,
        skiResortName: optionalString(value.skiResortName),
        weather: optionalString(value.weather),
        snowCondition: optionalString(value.snowCondition),
        impressions: stringOrEmpty(value.impressions),
        temperature: optionalNumber(value.temperature),
        companions: optionalString(value.companions),
        fatigueLevel: optionalNumber(value.fatigueLevel),
        expenses: optionalNumber(value.expenses),
        numberOfRuns: optionalNumber(value.numberOfRuns),
        createdAt: numberOrZero(value.createdAt),
        updatedAt: numberOrZero(value.updatedAt),
    };
}

function isRestorablePreferenceKey(key: string): boolean {
    return (RESTORABLE_PREFERENCE_KEYS as readonly string[]).includes(key);
}

/**
 * Validate and normalise a decoded backup into rows the repositories can take.
 *
 * Throws `ImportError` when the file cannot be a SnowLog backup at all. Rows
 * that fail validation are dropped and counted in `skipped`.
 */
export function parseExportPayload(raw: unknown): ImportPlan {
    if (!isRow(raw)) {
        throw new ImportError("notBackup");
    }

    const schemaVersion = requiredNumber(raw.schemaVersion);
    if (schemaVersion == null || schemaVersion < 1) {
        throw new ImportError("notBackup");
    }
    if (!(IMPORT_SUPPORTED_SCHEMA_VERSIONS as readonly number[]).includes(schemaVersion)) {
        throw new ImportError("newerVersion");
    }

    const skipped: ImportSkipCounts = {
        videos: 0,
        tags: 0,
        techniqueOptions: 0,
        favoriteResorts: 0,
        diaryEntries: 0,
    };

    const videos: ImportableVideo[] = [];
    const seenVideoIds = new Set<string>();
    const claimedPaths = new Set<string>();
    for (const candidate of asArray(raw.videos)) {
        const video = parseVideo(candidate, schemaVersion);
        if (video == null) {
            skipped.videos += 1;
            continue;
        }
        // A duplicated id would collide on insert; the first wins so the
        // outcome does not depend on insertion order.
        if (seenVideoIds.has(video.id)) continue;

        // Two rows cannot own one file. Compared case-insensitively because the
        // unique index is, and because the filesystem underneath may be too.
        // The loser is counted rather than silently dropped, and keeps nothing:
        // sharing ownership would let one row's deletion take another's media.
        if (video.managedVideoPath != null) {
            const claim = video.managedVideoPath.toLowerCase();
            if (claimedPaths.has(claim)) {
                skipped.videos += 1;
                continue;
            }
            claimedPaths.add(claim);
        }

        seenVideoIds.add(video.id);
        videos.push(video);
    }

    const tags: ImportableTag[] = [];
    for (const candidate of asArray(raw.tags)) {
        const tag = parseTagRef(candidate);
        if (tag == null) {
            skipped.tags += 1;
            continue;
        }
        tags.push(tag);
    }

    const techniqueOptions: { name: string; sortOrder: number }[] = [];
    for (const candidate of asArray(raw.techniqueOptions)) {
        const option = parseTechniqueOption(candidate);
        if (option == null) {
            skipped.techniqueOptions += 1;
            continue;
        }
        techniqueOptions.push(option);
    }

    const favoriteResorts: string[] = [];
    for (const candidate of asArray(raw.favoriteResorts)) {
        const name = requiredString(candidate);
        if (name == null) {
            skipped.favoriteResorts += 1;
            continue;
        }
        favoriteResorts.push(name);
    }

    const diaryEntries: ImportableDiaryEntry[] = [];
    for (const candidate of asArray(raw.diaryEntries)) {
        const entry = parseDiaryEntry(candidate);
        if (entry == null) {
            skipped.diaryEntries += 1;
            continue;
        }
        diaryEntries.push(entry);
    }

    const preferences: { key: string; value: string }[] = [];
    for (const candidate of asArray(raw.preferences)) {
        if (!isRow(candidate)) continue;
        const key = requiredString(candidate.key);
        const value = optionalString(candidate.value);
        if (key == null || value == null) continue;
        if (!isRestorablePreferenceKey(key)) continue;
        preferences.push({ key, value });
    }

    return {
        appVersion: optionalString(raw.appVersion) ?? "unknown",
        exportedAt: optionalString(raw.exportedAt) ?? "",
        videos,
        tags,
        techniqueOptions,
        favoriteResorts,
        diaryEntries,
        preferences,
        skipped,
    };
}
