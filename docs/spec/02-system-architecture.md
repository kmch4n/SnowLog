# System Architecture, Module Boundaries and Startup

## Technology / package topology

The root application is an Expo SDK 55 / React Native 0.83 / React 19.2 TypeScript application; Expo Router supplies file-based navigation, React Navigation supplies native navigation components, Expo SQLite stores data, and Drizzle ORM provides typed queries and generated SQL migrations. `src` is aliased as `@/` in the TS/Metro configuration. Native dependencies are configured through `app.json` and EAS, rather than a checked-in generated `ios/` directory.

A separate Astro 6 website (`pr/web`) and Remotion 4 video producer (`pr/pv`) have independent npm lockfiles, build commands and deploy artifacts. They are **not** runtime dependencies of the mobile app.

## Directed architecture

```text
iOS routes (src/app/, NativeTabs + Stack)
   -> reusable UI components (src/components/)
   -> hooks / UI orchestration (src/hooks/)
   -> business services (src/services/)
   -> repositories (src/database/repositories/)
   -> Drizzle/Expo SQLite (src/database/index.ts, schema.ts)
   -> OS SQLite file
   + file and media APIs (Expo FS / Photos / video) at service boundaries

Pure utilities (src/utils/) and shared types (src/types/)
   are reusable by hooks, services, components and repository query mapping.

Swift foundation (modules/snowlog-media/)
   currently linked via Expo module, but not wired into app media flows.

Web resolution uses .web.ts/.web.tsx companions and an in-memory store,
not Expo SQLite and not the native media/filesystem stack.
```

A route **should compose** state and present UI. Repositories own SQLite statements, services own business-side orchestration and side effects, hooks mediate loading, focus refresh, state and cancellation, and pure utilities own testable transformations. `src/app/video-import.tsx` currently mixes many stages and is 1,484 lines; Issue #80 explicitly tracks that architectural debt. This document describes the as-built implementation and does not imply that the desired separation has already been achieved.

## Route graph

| Route | Responsibility | Significant dependencies |
| --- | --- | --- |
| `src/app/_layout.tsx` | SQLite migration gate, startup tasks, root stack, error boundary | Drizzle migrator, storage and thumbnail migration services |
| `src/app/(tabs)/_layout.tsx` | Five-tab native navigation and SF Symbol labels | `expo-router/unstable-native-tabs` |
| `(tabs)/index/index.tsx` | Home/favorites, sections, ordering, selection, bulk action | `useVideos`, `useSelectionMode`, `useAppPreference` |
| `(tabs)/dashboard/index.tsx` | Season and statistics visuals, search drill-down | `useDashboard`, chart components |
| `(tabs)/calendar/index.tsx` | Month/week, day detail, diary editing | `useCalendarEnhanced`, `useDiaryEntry` |
| `(tabs)/search/index.tsx` | Filtered video list and navigation | `FilterBar`, `useVideos` |
| `(tabs)/settings/index.tsx` | Maintenance, settings navigation, backup note | orphan-file service |
| `video-import.tsx` | Single/batch Photos picker, staging and import | media, import, thumbnail and GPS modules |
| `video/[id].tsx` | Playback, metadata edits, favorites and deletion | `useVideoDetail`, `usePlaybackSource` |
| `settings/calendar.tsx` | First weekday | `useAppPreference` |
| `settings/techniques.tsx` | Technique CRUD and reorder | technique repository |
| `settings/tags.tsx` | Custom tag CRUD | tag repository |
| `settings/favorite-resorts.tsx` | Favorite-resort list | resort repository |
| `settings/duplicate-candidates.tsx` | Similar video detection and group deletion | duplicate detection, deletion service |

Each tab's nested `_layout.tsx` owns its stack header configuration. `src/app/_layout.web.tsx` replaces the visible browser root but Metro can still evaluate native route modules; Web-compatible dependency shims remain mandatory.

## Startup ordering is a safety contract

In `RootLayout` (native):

1. Create singleton Expo SQLite database `snowlog.db` on module import. Enable `PRAGMA foreign_keys = ON` and WAL mode (`src/database/index.ts`).
2. Run Drizzle migrations through `useMigrations(db, migrations)`. On migration error, render a failure screen; before success, render loading.
3. **Blocking storage backfill:** call `migrateVideoStorage()`. If it fails, stop further initialization and show a retry action. This must finish before file ownership is used by any cleanup or playback.
4. After storage migration, seed default technique options (record already-seeded names so user deletion stays deleted) and remove obsolete `app_locale` preference.
5. Check `thumbnail_migration_version` and, if needed, normalize/rebuild thumbnails with progress UI. A thumbnail migration exception is intentionally nonfatal: proceed to app UI.
6. After thumbnail work is done, defer maintenance via `InteractionManager.runAfterInteractions`: best-effort captured-date repair, orphaned-file cleanup, optional App Store version lookup/prompt. Failures of these background jobs are caught rather than blocking launch.
7. Render the root stack and screens.

**Do not reorder the storage migration behind cleanup**. Backfilled `storageMode` and managed paths determine file ownership. Reordering can make a legitimate copied video appear orphaned. A later fully integrated transfer-job recovery flow must also reconcile its pending outputs *before* orphan cleanup; current `RootLayout` does not yet invoke that recovery.

## Startup repair details

- `seedTechniqueOptions`: compare shipped `DEFAULT_TECHNIQUE_OPTIONS` with existing options and stored `technique_defaults_seeded` history; do not resurrect deleted defaults.
- `repairInvalidCapturedAt`: first full scan marked with `capturedAt_repair_version`; later fast scan for obviously invalid values (at/before 2000-01-01 UTC). Non-synthetic Photos assets may be corrected from `creationTime` when invalid or over 3,600 seconds away; asset lookup uses `shouldDownloadFromNetwork: false`. Individual failures do not abort the scan.
- `runThumbnailMigration`: normalize absolute legacy paths to `thumbnails/<id>.jpg` style, attempt local-source regeneration and otherwise persist missing sentinel. The migration version is written after finishing.
- `cleanupOrphanedFiles`: see [05-library-playback-and-deletion.md](05-library-playback-and-deletion.md); it also runs from Settings.
- `getOptionalUpdateInfo`: compare the app version with the App Store listing; suppress versions already dismissed in `app_preferences`.

## Cross-layer contracts

- Use `getTagsForVideos` for batched list hydration; `getTagsForVideo` is for one detail record. Ordering by tag ID is significant to list equality.
- `useVideos` refetches on focus and discards late responses when filter inputs have changed. A route must not use a stale fetch result to overwrite newer filtering.
- `useVideoDetail` refresh after save without an intervening loading screen; resetting the entire route would interrupt video playback and in-progress typing.
- `useAutosavedText` owns delayed save/flush/cancel separately for title and memo; a save callback must remain tied to the correct video ID.
- Use `hapticsService` and the shared `Icon` wrapper rather than importing lower-level packages throughout routes; ESLint restricts those direct imports.
- `mediaMutationCoordinator` provides a serialized operation queue; it is infrastructure, not proof that every existing mutation is routed through it.
- User-facing translations come from `useTranslation` (React) or `t` (non-React); locale is fixed from system settings per process start.

## Packaging / important directories

| Directory | Contract |
| --- | --- |
| `src/database/schema.ts` | Schema source; never hand-edit generated `drizzle/` SQL |
| `drizzle/` | Generated migrations plus schema snapshots and journal |
| `src/constants/skiResorts.json` | Bundled 378-resort master with coordinate fields |
| `assets/` | App artwork and icons |
| `modules/snowlog-media/` | Linked Swift core + Expo module entry point; not yet full PhotoKit adapter |
| `scripts/tests/` | Node-based behavioral/contract tests (many compile TS on demand) |
| `.maestro/` | Simulator UI flows and small movie fixtures |
| `.github/workflows/` | CI and dispatchable iOS simulator workflow |
| `docs/verification/` | Historical results, not guaranteed current state |
| `.memory/` | Shared operational knowledge, not a substitute for this contract |

**Source anchors:** `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/database/index.ts`, `src/hooks/`, `src/services/`, `src/database/repositories/`, `metro.config.js`. Related: [03-persistence-and-migrations.md](03-persistence-and-migrations.md), [10-quality-and-delivery.md](10-quality-and-delivery.md).
