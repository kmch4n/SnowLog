# Source Traceability and Change Impact Matrix

This is the entry point for locating implementation owners and expected regression checks **without opening every source file**. Paths identify ownership, not guarantees of test coverage. For an inventory of individual source modules, see [Source module catalog](module-catalog.md). The current baseline is recorded in [README](README.md).

## UI and user-journey map

| Feature / behavior | Screen | Hook / component | Durable or resource owner | Primary tests |
| --- | --- | --- | --- | --- |
| Home list, grouping, sort, favorites | `src/app/(tabs)/index/index.tsx` | `useVideos`, `useSelectionMode`, `VideoCardCompact` | `videoRepository`; `home_sort_order` | `videoListEquality`, `homeSwipeDelete`, app preference tests |
| Single video import | `src/app/video-import.tsx` | `SkiResortSearch`, `TagSelector`, `TechniqueSelector` | `importService`, `mediaService`, thumbnails, DB | `assetId`, `assetLookup`, `managedVideoPath`, `thumbnailPath` |
| Batch import and status | `src/app/video-import.tsx` | `BulkImportProgress`, `GpsConfirmationDialog` | `importService`, `bulkImportSummaryService` | `bulkImportProgressUtils`, `photosErrors` |
| GPS resort detection | Import screen | `SkiResortSearch`, `geoUtils` | `skiResorts.json`, `videoRepository` | `geoUtils` |
| Video details, tags, favorites | `src/app/video/[id].tsx` | `useVideoDetail`, `useAutosavedText` | `videoRepository`, `tagRepository` | `debouncedTask`, `tagRepository` |
| Playback/availability | `src/app/video/[id].tsx` | `usePlaybackSource` | `mediaService`, `managedVideoFileService` | `playbackSource` |
| Single/bulk deletion | Detail and Home/duplicates | `videoDeletionService` | `videoDeletionOrder`, thumbnail/managed files | `videoDeletionOrder`, `homeSwipeDelete` |
| Search and filter routing | `src/app/(tabs)/search/index.tsx` | `FilterBar`, `useVideos` | `videoRepository`, `searchRouteParams` | `videoSearch`, `dateUtils` |
| Calendar and diary | `src/app/(tabs)/calendar/index.tsx` | `useCalendarEnhanced`, `useDiaryEntry`, `DiaryEditModal` | `diaryEntryRepository`, `dateUtils` | `calendarUtils`, `dateUtils` |
| Dashboard and drill-down | `src/app/(tabs)/dashboard/index.tsx` | `useDashboard`, chart components | `dashboardRepository`, `dashboardStats` | `dashboardStats`, `dateUtils` |
| Technique settings | `src/app/settings/techniques.tsx` | `TechniqueSelector` | `techniqueOptionRepository`, seed service | `techniqueSeeding` |
| Custom tags | `src/app/settings/tags.tsx` | `TagSelector` | `tagRepository` | `deleteCustomTag`, `tagRepository` |
| Favorite resort suggestions | `src/app/settings/favorite-resorts.tsx` | `SkiResortSearch` | `favoriteResortRepository` | `geoUtils` plus manual |
| Duplicate candidates | `src/app/settings/duplicate-candidates.tsx` | Group selection UI | `duplicateDetectionService` | `duplicateDetectionService` |
| Startup and migrations | `src/app/_layout.tsx` | `ThumbnailMigrationScreen` | `migrateVideoStorage`, `thumbnailMigrationService` | `videoStorageMigration`, `migrationForeignKeys` |
| Orphan cleanup | Settings and startup | `orphanedFileCleanupService` | `orphanCleanupRun` | `orphanCleanupRun` |
| Language | All screens | `useTranslation` | `i18n/locales/ja.ts`, `en.ts` | `i18nKeys`, `i18nPlural` |
| Web preview | `*.web.ts(x)` | `WebAlertHost`, `webMockStore` | Web repositories / stubs | `webShimParity`, `webEmptyModules`, `npm run test:web` |

All referenced test shorthand above corresponds to `scripts/tests/<name>.test.cjs` unless noted as manual. Source-tracing a feature does not by itself prove its tests cover every failure mode.

## Persistence and ownership map

| Value / data | Storage | Primary readers | Writers and mutation rules |
| --- | --- | --- | --- |
| Video identity, metadata | `videos` | `useVideos`, `useVideoDetail`, dashboard | `importService` creates; `videoRepository` updates; DB-first deletion |
| Tags and associations | `tags`, `video_tags` | Library/detail/settings | `tagRepository`; replacements and custom deletes transactional |
| Technique choices | `technique_options` | Import/detail/settings | `techniqueOptionRepository`; seed migration respects deletion |
| Favorite resort names | `favorite_resorts` | Resort search/settings | `favoriteResortRepository` |
| Diary per day | `diary_entries` | Calendar/edit modal | `diaryEntryRepository` upsert/delete by date key |
| Home sort | `app_preferences.home_sort_order` | Home | `useAppPreference` on focus/change |
| Week start | `app_preferences.weekStartDay` | Calendar/settings | `useAppPreference` |
| Media priority (not wired) | `app_preferences.media_priority` | `mediaPolicyService` only | Primitive service only; no shipping selector |
| Incomplete video transfer (not wired) | `video_transfer_jobs` | `videoTransferJobRepository` | Transfer runner/repo primitives; not shipping queue |
| Thumbnail | `Documents/thumbnails/` | Cards and player preview | Import; migration; DB-first cleanup |
| Managed copy | `Documents/videos/` | Playback in `copy` mode | Synthetic import; storage migration paths; deletion/cleanup |
| Original Photos movie | User's Photos library | Import/player in `reference` mode | External to app; never delete on app record deletion |
| Bulk import summary | Process memory | Home on focus | `bulkImportSummaryService`; consumed once |
| Expo Web mock | Process memory | Browser routes | `webMockStore`; no SQLite |

## Critical invariants and regression targets

| Invariant | Source of truth | What a regression should attempt to break |
| --- | --- | --- |
| Storage migration precedes owned-file cleanup | `src/app/_layout.tsx` | Old synthetic video persists through upgrade |
| Managed path ownership cannot collide case-insensitively | `src/database/schema.ts`, `videoStorageBackfill.ts` | Two IDs differing only in case |
| DB deletion completes before any file removal | `videoDeletionOrder.ts` | Inject DB delete failure and verify all files still exist |
| Newly created files protected during cleanup | `orphanCleanupRun.ts` and import protection | Interleave cleanup enumeration and import commit |
| Limited Photos access ≠ missing asset | `playbackSource.ts`, `usePlaybackSource.ts` | Remove and then restore Photos authorization |
| Autosave does not restart player | `useAutosavedText.ts`, `usePlaybackSource.ts` | Edit memo during active playback; immediately navigate away |
| Shared season starts October 1 | `dateUtils.ts` | June–September video included exactly once; 12 trend months |
| Date keys reflect local date | `dateUtils.ts`, `calendarUtils.ts` | Capture near midnight in differing time zones |
| Tag deletion cannot affect non-custom tag types | `tagRepository.ts` | Pass a skier/technique tag ID to custom-delete |
| Native/Web export parity | `*.web.ts` and `webShimParity` | Add a native export without Web equivalent |
| Media consent never survives as transferable job permission | `mediaPolicy.ts`, `videoTransferJob.ts` | Parse stored payload containing implicit allow flag |
| Job complete and cancelled have different meaning | `videoTransferJob.ts` | Late callback after cancellation |
| Web import unsupported rather than fake success | `video-import.web.tsx` | Browser navigation into import route |

## Current vs. planned source changes

The following items are **not** live just because source infrastructure exists:

| Intended capability | Existing supporting code | Missing shipping edge |
| --- | --- | --- |
| Device-storage/mobile-data preference | `mediaPolicyService.ts`, `mediaPolicy.ts` | Settings/first-import UI; policy call from importer and playback |
| Identifier-only PHPicker | `SnowLogMediaModule.swift`, Swift core | Real native API, adapter, and UI binding |
| Durable background-safe acquisition | `videoTransferJob.ts`, job repo, runner and recovery planner | Live queue/execution, event wiring, reconcile on startup |
| Reference-to-copy conversion | `commitConvertedVideo`, transfer payload types | User operation and verified acquisition adapter |
| Cross-device Photos re-link | Existing Photos IDs and video metadata | Matching, confirmation and safe remapping after restore |
| User capture-date editing | `updateVideoCapturedAt` | Explicit editor, validation, refresh and analytics invalidation |

For these features consult [Media-priority infrastructure](media-priority-infrastructure.md) and their open GitHub Issues; implementation status is **not** inferred from types, tests or unreferenced functions.

## Source and document ownership matrix

| Change type | Specifications to read/update first |
| --- | --- |
| Screen routes, hooks, navigation | `architecture.md` + target feature chapter + this map |
| SQLite table or index | `data-model.md` + `startup-and-maintenance.md` + `verification-and-release.md` |
| Import, picker, GPS | `import-and-resorts.md` + `library-and-playback.md` |
| Copy/reference and permission policy | `library-and-playback.md` + `media-priority-infrastructure.md` + `product-and-status.md` |
| File cleanup and restore | `library-and-playback.md` + `startup-and-maintenance.md` |
| Date rules, diary, search and dashboard | `calendar-search-and-analytics.md` + `data-model.md` |
| Settings, typography, language | `settings-and-presentation.md` + target screen behavior |
| Web platform or external media | `web-and-promotion.md` + `verification-and-release.md` |
| Automated test and release procedure | `verification-and-release.md` + `AGENTS.md` if contributor requirements change |
| Delivered vs planned capability | `product-and-status.md` + the feature chapter + Issue status |

## Known limitations of this map

File and function names are stable navigation hints, not a complete call graph or substitute for a review of changed source. The UI importer is a known large orchestration unit (Issue #80). Product features can straddle pure utilities and native wrappers; a narrowly passing unit test may not exercise the integration. Future changes should update both the feature document and its row here when owners or important dependencies move.

## Sources

`src/app/`; `src/components/`; `src/hooks/`; `src/services/`; `src/utils/`; `src/database/`; `src/types/`; `modules/snowlog-media/`; `scripts/tests/`; `AGENTS.md`; `.memory/testing.md`.
