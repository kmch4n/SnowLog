# Startup, Migrations, Cleanup, Update Checks, and Backup

## Critical native startup sequence

`src/app/_layout.tsx` controls when the iOS application becomes interactive. This is a dependency **barrier** sequence, not a list of independent best-effort tasks:

```text
Expo SQLite opens snowlog.db (foreign_keys=ON, journal_mode=WAL)
   ↓
Drizzle useMigrations succeeds
   ↓
storageMigrationService.migrateVideoStorage()  [BLOCKING]
   ├─ success → proceed
   └─ failure → blocking error UI with explicit retry
   ↓
technique-option seeding + old app_locale deletion (best effort)
   ↓
thumbnailMigrationService (blocking progress screen if needed)
   ├─ success → done
   └─ failure → log/recover through future launch; app continues
   ↓
Native navigation stack becomes interactive
   ↓
InteractionManager.runAfterInteractions:
  repairInvalidCapturedAt()
  cleanupOrphanedFiles()
  getOptionalUpdateInfo()
(all nonblocking / failure-isolated)
```

**Invariant:** Storage backfill must finish **before** thumbnail repair, orphan cleanup, capture-date repair, playback, or import paths can run. The cleanup logic uses `storage_mode` and `managed_video_path` to identify owned copies. Running it before the backfill can wrongly delete existing managed movies.

Transfer-job recovery logic exists as pure infrastructure but is **not** called by this startup layout. Do not claim transfer-job replay/recovery works on app restart until the integration is implemented and verified.

## Schema migration

`useMigrations(db, migrations)` applies generated migrations and gates the remaining initialization. A schema migration error renders the failure message instead of a partially initialized UI. `drizzle/` migration SQL is generated with `npm run db:generate`.

**Foreign-key hazard:** The database opens with foreign keys enabled. SQLite ignores `PRAGMA foreign_keys=OFF` inside a transaction, while the Drizzle migrator applies batches transactionally. A generated "rebuild videos table" migration may drop the original table while foreign keys are still active, cascading deletion of `video_tags`. The repository's `migrationForeignKeys.test.cjs` guards against introducing a table-rebuild migration without explicit, reviewed handling. For unavoidable rebuilds, devise a migration boundary that disables FK enforcement **outside** the transaction, re-enables it afterward and runs `PRAGMA foreign_key_check`, then verify a populated upgrading device database. Never blindly apply generated SQL simply because generation succeeds.

## Storage-mode backfill (v1)

`migrateVideoStorage` checks `app_preferences.video_storage_migration_version` (current value `1`). For each legacy row it reads ID, asset ID and filename and computes:

- Non-synthetic asset ID → `reference`, no managed path.
- Synthetic asset ID + safe video ID → `copy`, deterministic `videos/<id>.<extension>` path.
- Synthetic with unsafe ID → `copy` but null path, marked unavailable (cannot invent a safe target).
- Two would-be owners whose managed filenames differ only in case → one deterministic owner, the other becomes pathless/unavailable.

The plan does not fetch Photos assets or check remote bytes, so it does **not** cause cloud acquisition. `applyStorageBackfill` performs all updates and writes the completed marker in **one synchronous SQLite transaction**. On failure the app blocks further startup with a retry UI, rather than allowing maintenance to operate on partially migrated ownership.

## Default technique seeding and stale preference cleanup

`seedTechniqueOptions` uses `DEFAULT_TECHNIQUE_OPTIONS`, currently present choices and the JSON list in `technique_defaults_seeded`. It only seeds defaults that have not previously been registered, respecting earlier user deletions. An obsolete `app_locale` preference from the removed in-app language picker is deleted idempotently on startup.

These tasks run after storage migration. Their failures are caught so they do not hard-block the app; unlike the storage ownership barrier, neither directly determines whether a managed movie is safe to delete.

## Thumbnail migration

`thumbnail_migration_version` (current value `1`) controls one-time processing. The migration:

1. Normalizes old absolute poster URLs into relative `thumbnails/<id>.jpg`.
2. Checks whether the owned JPEG exists.
3. If missing, attempts to generate it from the correct movie source: a managed path for `copy` or a Photos lookup with `shouldDownloadFromNetwork: false` for `reference`.
4. If regeneration is impossible, writes the empty missing sentinel and allows the UI to render a placeholder.
5. Advances the migration marker after iterating rows, reporting progress to a blocking screen.

Errors in an individual row do not abort the whole pass. An outer migration failure is caught in the root and does not permanently prevent the app from opening; future remediation may be needed. The stated local-only Photos request flag is a request hint in this existing Expo path, **not** proof of complete network isolation for every underlying native operation.

## Capture-date repair

`repairInvalidCapturedAt` uses preference `capturedAt_repair_version = "1"`:

- On first run or after repair version change, scan all videos; skip synthetic identities, compare existing seconds with Photos creation time (milliseconds converted), and correct invalid values (at/before 2000-01-01) or more than **one hour** away.
- On later launches, query only rows with an obviously invalid timestamp (at/before the minimum).
- Query Photos with `shouldDownloadFromNetwork: false`. Per-item missing metadata or iCloud errors are skipped.
- This operation runs after interactions and does not block startup. It is **not** a user-facing captured-date editor.

The repair marker is stored only for the full-scan mode. If failures prevent repairing a particular asset, future explicit editing remains a separate feature (Issue #93).

## Orphan-file maintenance

After the app is interactive, `cleanupOrphanedFiles` can reclaim unreferenced JPEGs and managed movie files, subject to a **five-minute** age window, importer protection set, live-reference recheck, and special protection for pathless copy rows. A Settings action invokes the same service with a confirmation. File ownership is defined in [Library and playback](library-and-playback.md); never loosen safeguards during a refactor merely because an isolated cleanup test still passes.

## Optional App Store update lookup

`updateCheckService.getOptionalUpdateInfo` fetches Apple's `https://itunes.apple.com/lookup?id=6761445679&country=jp` API with a **five-second** abort timeout. It compares the App Store version to `Constants.expoConfig.version`. If remote is newer and not dismissed in `dismissed_update_prompt_version`, the app shows a nonmandatory alert: postpone, or open the App Store URL. A dismissal applies to that exact reported version, not all future versions. Offline/API/parse failures do not block normal startup.

This is a real external network request; SnowLog's lack of a personal backend does not mean there are no network requests whatsoever.

## Backup, restoration, and data loss

No app-managed JSON export/restore exists in 1.4.0. A previous JSON feature was removed under Issue #90. Local app data is stored under Documents, including SQLite (`Documents/SQLite/snowlog.db`), poster files and managed movies; the OS may include these in **iCloud device backup** when user settings and quota permit. The app does not know whether a backup succeeded, expose a backup control or provide in-app restore. Restoration is tied to device setup from a full OS backup; reinstalling SnowLog alone does **not** restore a deleted app container.

Photos reference identities are not guaranteed portable to another restored device. A video row can survive the restore but fail to locate its original movie. This is the unresolved cross-device re-link scope of Issue #85, and users must not be promised full migration of playable references. Managed movie bytes are also subject to actual OS backup availability and space.

## Release-safe change constraints

- Any schema change: review migrations against **existing populated records**, not only a clean install.
- Any change to `storage_mode`, managed path resolution or cleanup: verify the startup barrier and simulate partial failures.
- Any date logic change: check locale/timezone differences and boundary dates across Calendar, Search and Dashboard.
- Any new background task: state whether it may initiate Photos/network work and whether it must wait for migrations.
- Any new backup statement: distinguish app local data, Photos library, OS device backup, cloud sync and application-specific export.

## Sources

`src/app/_layout.tsx`; `src/database/index.ts`; `src/services/{storageMigrationService,videoStorageBackfill,thumbnailMigrationService,orphanedFileCleanupService,updateCheckService}.ts`; `src/database/repositories/videoStorageRepository.ts`; `src/utils/techniqueSeeding.ts`; `scripts/tests/migrationForeignKeys.test.cjs`; `docs/verification/1.4.0-testflight.md`; Issue #85 and #90.
