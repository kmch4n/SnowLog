# SQLite Data Model and Persistence Contracts

## Connection, migrations and unit conventions

`src/database/index.ts` opens `snowlog.db` synchronously through `expo-sqlite`, enables change listeners, `PRAGMA foreign_keys = ON`, and `PRAGMA journal_mode = WAL`, and exports one Drizzle instance. `src/database/schema.ts` is the editable schema; `drizzle/0000_*.sql` through `0009_*.sql` and metadata are generated migrations. Do not modify generated SQL manually without an explicitly reviewed migration strategy.

**Units:** `videos.captured_at`, `created_at`, `updated_at`, `diary_entries.created_at/updated_at` and job timestamps are Unix **seconds**. Photos `creationTime` received from Expo is in **milliseconds**, converted on import. `videos.duration` is in **seconds**. Diary temperature is **Celsius** and expenses are **JPY**. `diary_entries.snow_condition` is a nullable TEXT column: the current editor stores a **JSON array string** of multiple condition codes, and reads a legacy single-code string as a one-element list. `date_key` is a local `YYYY-MM-DD` string, not a UTC date.

## `videos`: primary library entity

| Column (TS property) | Database type / default | Meaning and contract |
| --- | --- | --- |
| `id` | TEXT primary key | Generated video identity (normally UUID); names the managed file |
| `asset_id` (`assetId`) | TEXT not null, unique | Original Photos identifier or a `synthetic:` fallback |
| `filename` | TEXT not null | Source filename; also searched |
| `thumbnail_uri` (`thumbnailUri`) | TEXT not null | Canonical relative `thumbnails/<id>.jpg` or empty sentinel |
| `duration` | INTEGER, default 0 | Whole-number seconds |
| `captured_at` (`capturedAt`) | INTEGER not null | Unix seconds; basis of sorting, seasons and calendar |
| `ski_resort_name` | TEXT nullable | User-selected or GPS-suggested ski resort name |
| `memo` | TEXT default empty string | Freeform note |
| `title` | TEXT nullable | User display title; fallback to filename in some surfaces |
| `techniques` | TEXT nullable | JSON-serialized array of technique **names**, not foreign keys |
| `is_file_available` | INTEGER default 1 | 0/1 cache of playback-source availability; re-evaluated on detail |
| `is_favorite` | INTEGER default 0 | 0/1 favorite flag |
| `storage_mode` | TEXT default `reference` | Effective movie source: `reference` or `copy` |
| `managed_video_path` | TEXT nullable | Relative `videos/<id>.<ext>` for managed files; null for normal references |
| `created_at` / `updated_at` | INTEGER not null | Unix-second provenance and mutation timestamp |

The unique index `videos_managed_video_path_unique` applies `lower()` to `managed_video_path` to prevent two rows claiming the same filename on case-insensitive filesystems. Multiple null paths are allowed. Index ownership rules are **more specific** than a generic "copy if synthetic" heuristic.

## Related tables

| Table | Fields / constraints | Application-level meaning |
| --- | --- | --- |
| `tags` | `id` auto-increment PK; `name`; `type`; unique (`name`, `type`) | Types `technique`, `skier`, `custom`; custom tags are user-editable |
| `video_tags` | `video_id` → `videos.id`; `tag_id` → `tags.id`; both ON DELETE CASCADE | Many-to-many associations; no separate relationship ID |
| `technique_options` | auto ID, unique `name`, `sort_order` default 0 | Selectable technique choices; deleting a choice does not rewrite historical video JSON |
| `favorite_resorts` | auto ID; unique `name` | Search/autocomplete shortcuts; not a normalized FK from videos |
| `diary_entries` | auto ID; unique `date_key` | One diary entry per local calendar day, independent of video rows |
| `app_preferences` | TEXT `key` PK, TEXT `value` not null | Durable string key/value settings and migration markers |
| `video_transfer_jobs` | TEXT job ID PK, unique `asset_id`, kind, video ID, state, JSON payload, error, timestamps | **Infrastructure**, pending/failed/uncompleted transfer intent; not consumed by current import UI |

`technique_options` and `favorite_resorts` are lookup data, not relational children of videos. Names may persist in historical video records after a selectable option is deleted. Diary entries are linked to videos by **date calculation**, not by a DB FK.

## Diary fields

`diary_entries` stores `date_key`, nullable `ski_resort_name`, `weather`, `snow_condition`, `temperature`, `companions`, `fatigue_level`, `expenses`, `number_of_runs`, plus non-null `impressions` (default empty) and timestamps. Weather is a nullable single string code; snow conditions are saved as a **JSON-encoded array of codes** in the nullable `snow_condition` TEXT field (or null for no selections). The editor also accepts legacy single-code strings on load. Option codes are supplied by `src/constants/diaryOptions.ts`; fatigue is a 1–5 integer in UI. `upsertDiaryEntry` uses `date_key` as its conflict target; deleting a diary does not delete videos.

## Transfer-job data (infrastructure only)

`video_transfer_jobs` uses `id` as an operation/ownership token and `asset_id` uniqueness to forbid two retained jobs for one Photos asset. `kind` is `import` or `convert`; `state` is one of `pending`, `running`, `waiting_wifi`, `paused`, `failed`. `payload_json` contains a validated version-1 snapshot (`VideoTransferPayload`), including asset metadata, import metadata if applicable, storage intent `copy`, target relative path and optional verified output descriptor. `error_code` uses the shared media failure union. Successful jobs are removed atomically with their final video write in `videoTransferJobRepository`. Existing app screens do **not** yet use these repository APIs as a complete feature.

## Preference keys

| Key | Typical value | Responsibility |
| --- | --- | --- |
| `home_sort_order` | `newest` / `oldest` / `resort` | Home sort picker; default `newest` |
| `weekStartDay` | `monday` / `sunday` | Calendar; legacy camelCase key must not be silently renamed |
| `technique_defaults_seeded` | JSON array of seed names | Protects user-deleted initial choices from reappearing |
| `video_storage_migration_version` | `1` | Backfill gate from old identity-derived storage semantics |
| `thumbnail_migration_version` | `1` | One-time relative-thumbnail normalization/recovery |
| `capturedAt_repair_version` | `1` | Controls first full scan versus fast date repair |
| `dismissed_update_prompt_version` | App Store version string | Suppresses a repeated optional update prompt |
| `media_priority` | `save_space` / `save_data` / absent | **Persistence contract exists; selection is not wired to the current importer** |
| `app_locale` | legacy value | Removed language-picker key; deleted at startup |

`getPreference` returns null when absent; `setPreference` is an upsert. Add new keys to this table and document migration and fallback semantics. Do not silently treat an invalid media-priority value as consent to a network request.

## Repository and transaction semantics

- `videoRepository.getVideosByFilter` combines resort, captured-at bounds, text, favorites and tag-ID conditions. Text matching escapes SQL LIKE wildcards and searches `filename`, `title` and `memo`; default ordering is capture date descending.
- `tagRepository.getTagsForVideos` batches tag queries to avoid per-video round trips and preserves tag-ID order for stable list comparison.
- `tagRepository.setTagsForVideo` replaces association rows in a **synchronous** SQLite transaction; `deleteCustomTag` checks the tag type before deleting links and the tag.
- `techniqueOptionRepository.reorderTechniqueOptions` updates all `sort_order` values transactionally; new choices append after the current **maximum order**, not row count.
- `videoTransferJobRepository.commitImportedVideoWithTags` atomically inserts video, checks tags still exist, attaches them and removes its job; `commitConvertedVideo` changes storage fields and removes the job without replacing the video identity.
- `videoStorageRepository.applyStorageBackfill` updates existing rows and migration marker in the same transaction; a separate marker write could permit accidentally rolling back later user selections.

## Data invariants

1. Never persist an absolute app-container URI in `thumbnail_uri` or `managed_video_path`; iOS may relocate the container.
2. Never attach two video rows to the same managed file, even if only the filename case differs.
3. The owner of a managed movie is the `managed_video_path` on a `copy` row, not the shape of `asset_id`.
4. Preserve historical technique strings after deleting a choice, until the user edits that video.
5. Store the user's local-day key consistently across calendar, diary and dashboard; do not mix UTC midnight boundaries.
6. Keep transfer-job intent distinct from a committed video: an incomplete job does not count as a library video.
7. Schema rewrites that drop/recreate `videos` need extra foreign-key scrutiny; see [Verification and releases](verification-and-release.md).

## Sources

`src/database/schema.ts`; `src/database/index.ts`; `src/database/repositories/{videoRepository,tagRepository,techniqueOptionRepository,diaryEntryRepository,videoTransferJobRepository,videoStorageRepository,appPreferenceRepository}.ts`; `src/types/index.ts`; `src/types/media.ts`; `src/utils/dateUtils.ts`.
