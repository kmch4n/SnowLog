# Persistence Model, Migrations and Data Ownership

## Persistence engine

The native app uses `expo-sqlite` with `drizzle-orm/expo-sqlite`. Database name: `snowlog.db`. `src/database/index.ts` opens it synchronously with change listeners, enables foreign keys and switches SQLite to WAL. Schema is defined in `src/database/schema.ts`; numbered SQL migrations `drizzle/0000...0009` and `drizzle/meta/` are generated with `npm run db:generate` and **MUST NOT** be edited manually. `src/database/index.web.ts` is deliberately inert; browser repositories are backed by `src/mocks/webMockStore.ts`.

All `created_at`, `updated_at` and `captured_at` integer timestamps are **Unix seconds**. Expo/Photos `creationTime` is **milliseconds** and must be divided by 1,000 before persistence. Calendar diary keys are **local** `YYYY-MM-DD` strings, not UTC timestamps. A period's local-day boundary is computed by `dateUtils`.

## Entity relationship model

```text
videos (id PK, asset_id UNIQUE)
  |--< video_tags (video_id -> videos.id ON DELETE CASCADE)
            >-- tags (id PK, UNIQUE name+type)

technique_options (independent editable selectable vocabulary)
favorite_resorts (independent name catalog)
diary_entries (UNIQUE date_key; one diary per local day)
app_preferences (string key/value store)
video_transfer_jobs (pending intent/state, not a finished video row)
```

`video_tags` has FK cascades from videos and tags. The schema does not declare a composite unique index on its two columns; app-level insertion uses conflict-ignoring calls, and `setTagsForVideo` replaces the full association set transactionally. Do not assume a database-enforced uniqueness constraint that is absent.

## `videos` column contract

| Column | SQLite type | Meaning, default, constraints |
| --- | --- | --- |
| `id` | TEXT | Primary key, normally UUID generated on import |
| `asset_id` | TEXT | Non-null, unique Photos asset identity; synthetic prefix permitted |
| `filename` | TEXT | Original/fallback name, non-null |
| `thumbnail_uri` | TEXT | Non-null stored path, usually relative; empty string is missing sentinel |
| `duration` | INTEGER | Seconds, rounded for imported records; default 0 |
| `captured_at` | INTEGER | Unix seconds; canonical date for calendar, search and statistics |
| `ski_resort_name` | TEXT | Nullable free text; resort master is for suggestions, not FK |
| `memo` | TEXT | Free text, default empty |
| `title` | TEXT | Optional editable display title; null falls back to filename in UI |
| `techniques` | TEXT | Nullable JSON array of technique-name strings; *not* linked to option IDs |
| `is_file_available` | INTEGER | 1/0 cache of playback availability; default 1, not authoritative permission proof |
| `is_favorite` | INTEGER | 1/0, default 0 |
| `storage_mode` | TEXT | Non-null `reference`/`copy`, default `reference` |
| `managed_video_path` | TEXT | Nullable app-owned **relative** path; generally `videos/<id>.<ext>` for copy |
| `created_at` | INTEGER | Creation epoch seconds |
| `updated_at` | INTEGER | Last update epoch seconds |

A unique index on `lower(managed_video_path)` prevents two rows claiming the same managed path on a case-insensitive filesystem; SQLite permits multiple NULL paths. **Photos identity and file ownership are independent**: a non-synthetic `assetId` can eventually have a `copy` row; synthetic IDs are historically the reason for copy, not a permanent storage-mode discriminator.

A `copy` row without a valid managed path can be retained as unavailable rather than inventing or deleting data. A `reference` row should not own an app-managed movie file.

## Other tables

| Table | Columns and invariants | Access layer |
| --- | --- | --- |
| `tags` | `id` auto integer PK, `name` non-null, `type` non-null `technique`/`skier`/`custom`; unique (`name`, `type`) | `tagRepository` |
| `video_tags` | `video_id` and `tag_id` non-null FK cascade; join between videos and tags | `tagRepository` |
| `technique_options` | `id` auto PK, unique `name`, `sort_order` default 0; user deletion does not rewrite strings already stored in video `techniques` | `techniqueOptionRepository` |
| `favorite_resorts` | `id` auto PK, unique non-null `name` | `favoriteResortRepository` |
| `app_preferences` | `key` TEXT PK, `value` TEXT non-null; application code validates/parses value types | `appPreferenceRepository` |
| `diary_entries` | `id` auto PK, `date_key` TEXT unique, optional resort/weather/snow/impressions/temperature/companions/fatigue/expenses/runs; created/updated seconds | `diaryEntryRepository` |
| `video_transfer_jobs` | `id` TEXT PK, unique `asset_id`, `kind`, `video_id`, `state`, `payload_json`, optional `error_code`, created/updated seconds | `videoTransferJobRepository` |

Diary specifics: `weather` stores an option value; `snow_condition` is JSON-encoded selected condition values in the current editor; `impressions` defaults to empty; `temperature` is °C, `expenses` is yen, `fatigue_level` uses the app's 1–5 scale. `date_key` governs one upserted diary per calendar day. `number_of_runs` is entered diary data; video count is a separate metric.

`video_transfer_jobs` represents **unfinished acquisition/conversion intent**. Intended `kind` values: `import` and `convert`. Intended `state` values: `pending`, `running`, `waiting_wifi`, `paused`, `failed`. A completed transfer is committed to `videos` and its job row removed. The table, repository and pure state functions exist, but the current import UI is not yet powered by this queue (Issue #86); see [08-media-infrastructure.md](08-media-infrastructure.md).

## Persistence preferences

| Key | Meaning / producer |
| --- | --- |
| `home_sort_order` | `newest`, `oldest`, `resort`; defaults to newest in UI |
| `weekStartDay` | `monday` or `sunday`, defaults to Monday; historic camel-case exception |
| `technique_defaults_seeded` | JSON names already seeded; prevents deleted defaults from returning |
| `capturedAt_repair_version` | Startup capture-date repair version 1 |
| `thumbnail_migration_version` | Relative-thumbnail migration version 1 |
| `video_storage_migration_version` | Storage backfill version 1; MUST accompany transaction |
| `dismissed_update_prompt_version` | App Store version whose optional prompt was dismissed |
| `media_priority` | Persisted `save_space`/`save_data` preference supported by service, but current UI does not expose completed end-to-end feature |
| `app_locale` | Legacy key intentionally deleted during startup; no longer defines language |

Keys are strings and the table has no schema-level enum checks; each consumer must defensively validate stored values. Do not rename persisted keys casually or change default interpretations without a migration/compatibility plan.

## Repository behavior and transaction semantics

- `videoRepository.getVideosByFilter` composes SQLite conditions for resort, inclusive capture range, escaped substring SQL `LIKE` on **filename, title and memo**, favorites and selected tag IDs. Default sort is captured-date descending.
- `tagRepository.getTagsForVideos` hydrates tags for an entire list using a join. Its tag ordering is ascending `tags.id` and is significant to `areVideoListsEqual`.
- `tagRepository.setTagsForVideo` deletes existing associations and inserts replacements in one synchronous transaction.
- `diaryEntryRepository.upsertDiaryEntry` replaces the diary fields on `date_key` conflict, retaining the original created timestamp.
- `videoTransferJobRepository.commitImportedVideoWithTags` inserts video row, links tags and removes the job in **one synchronous transaction**; checks tag IDs again first.
- `commitConvertedVideo` updates an existing reference row to `copy` and removes the job atomically, without replacing video identity/metadata/tags.
- `videoStorageRepository.applyStorageBackfill` updates rows and writes the migration marker atomically.

**Critical driver detail:** The shipping Drizzle Expo SQLite transaction callback is synchronous. Write database operations inside it using `.run()`/`.all()`, **not** an `async` callback or `await` that would commit before later statements execute. The repository harness tests this behavior.

## Migration and recovery

1. Apply generated Drizzle schema migrations.
2. Read `video_storage_migration_version`. On first run, plan every existing row with `videoStorageBackfill.planStorageBackfill`: synthetic `assetId` -> `copy` and inferred path; all other rows -> `reference` and null path. No Photos/network read is performed.
3. Reject unsafe file IDs; make that copy unavailable with no invented path. For case-insensitive path collision, retain deterministic lexicographically first owner and mark losers unavailable; do not destroy files to hide conflicts.
4. Apply all row changes and version marker together. Once marked, do not rerun backfill and overwrite later user choices.
5. Only then run thumbnail migration and eventually orphan cleanup. A failed storage migration stops startup for user-initiated retry.

The generated schema has ten numbered migrations through `0009` as of this baseline. Migration metadata is committed along with generated SQL.

## Filesystem ownership and backup

Managed movies reside relative to app `Documents/videos/` and thumbnails under `Documents/thumbnails/`; the SQLite database is in the app's SQLite Documents area. **Never persist a container-absolute URI**: iOS may relocate the application container. Resolve the relative path at read/delete time.

The app does not implement its own cloud sync or JSON file backup. On iOS, application Documents can be included in **device iCloud Backup** if user/OS backup conditions permit. The app does not determine backup success and cannot restore data just by reinstalling. Photos-referenced media bytes are not made into app-owned copies merely by backing up the database; Photos identifiers may need relinking after migration to a new phone (#85).

**Evidence:** `src/database/schema.ts`, `src/database/index.ts`, `src/database/repositories/`, `src/services/videoStorageBackfill.ts`, `src/services/storageMigrationService.ts`, `src/utils/managedVideoPath.ts`, `src/app/_layout.tsx`, `scripts/tests/videoStorageMigration.test.cjs`.
