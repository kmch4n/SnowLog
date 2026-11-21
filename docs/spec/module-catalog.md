# Source Module Catalog

> **Baseline:** `848264a`, reviewed 2026-11-21
> **Status:** Repository source index, not a second functional specification

This index enumerates the source-level implementation ownership across the Expo application, Swift media groundwork, Astro website, Remotion film and root utilities. It complements [Architecture](architecture.md), [Feature traceability](traceability.md), and [Verification](verification-and-release.md): those chapters define **behavior and invariants**, while this catalog answers **where to inspect a specific concern**.

Entries are short navigation descriptions, not invented call-graph or product-availability claims. An exported helper can be unreferenced by the shipping app. The relevant feature specification defines whether the code is *active*, *infrastructure only*, or *proposed*. Platform `.web.ts(x)` companions are listed separately because they may diverge from native implementation.

## Coverage and repository boundaries

The tracked baseline contains **144 application TS/TSX/JS source files under `src/`** (including the Web mock), **10 native Swift source/test files**, **16 Astro site source files**, **30 Remotion source/test files**, and **5 root helper scripts**. The Node test directory holds **45 direct test files plus one shared helper**. Static assets, data files, schema SQL snapshots, dependency locks and historical docs are outside this source-file inventory, but remain part of the repository.

The bundled resort data set is `src/constants/skiResorts.json` (378 rows at the reviewed baseline). The schema migration history lives in `drizzle/`; only the editable schema in `src/database/schema.ts` should be authored by hand. Native packaging metadata is in `modules/snowlog-media/expo-module.config.json` and the CocoaPods specs. See [Data model](data-model.md) before changing migrations.

## Expo Router screens

| Source file | Contract and responsibility |
| --- | --- |
| `src/app/_layout.tsx` | Native root initialization and stack; enforces migration barriers before rendering. |
| `src/app/_layout.web.tsx` | Browser entrypoint without native SQLite startup; hosts Web alerts. |
| `src/app/(tabs)/_layout.tsx` | Five-tab navigation through native platform tabs. |
| `src/app/(tabs)/index/_layout.tsx` | Home tab's nested navigation header. |
| `src/app/(tabs)/index/index.tsx` | Home resort sections, sort, favorites, selection, deletion and import entry. |
| `src/app/(tabs)/dashboard/_layout.tsx` | Dashboard nested navigation header. |
| `src/app/(tabs)/dashboard/index.tsx` | Season picker, charts, latest videos and search drill-down. |
| `src/app/(tabs)/calendar/_layout.tsx` | Calendar nested navigation header. |
| `src/app/(tabs)/calendar/index.tsx` | Month/week views, day selection, diary panel and gesture transitions. |
| `src/app/(tabs)/search/_layout.tsx` | Search nested navigation header. |
| `src/app/(tabs)/search/index.tsx` | Search filter state, routed filters and result list. |
| `src/app/(tabs)/settings/_layout.tsx` | Settings nested navigation header. |
| `src/app/(tabs)/settings/index.tsx` | Settings menu, maintenance cleanup confirmation and backup guidance. |
| `src/app/settings/calendar.tsx` | Week start selector persisted as a preference. |
| `src/app/settings/duplicate-candidates.tsx` | Duplicate groups, item selection and confirmed deletion. |
| `src/app/settings/favorite-resorts.tsx` | Manage saved resort suggestions. |
| `src/app/settings/tags.tsx` | Manage custom tags. |
| `src/app/settings/techniques.tsx` | Add, reorder and remove selectable technique names. |
| `src/app/video-import.tsx` | Current native single/bulk picker and staging orchestration; an acknowledged large route. |
| `src/app/video-import.web.tsx` | Explicitly unsupported browser importer. |
| `src/app/video/[id].tsx` | Native playback, metadata editing and deletion. |
| `src/app/video/[id].web.tsx` | Simplified Web preview of a video record. |

## Shared screens and components

| Source file | Contract and responsibility |
| --- | --- |
| `src/components/BulkActionToolbar.tsx` | Selected-video favorite, deletion and cancel actions. |
| `src/components/BulkImportProgress.tsx` | Batch import phase, progress and stop-request presentation. |
| `src/components/CalendarDayCell.tsx` | Single month/day visual cell and accessible selection. |
| `src/components/CalendarMonthGrid.tsx` | Month grid, weekday alignment and selected date. |
| `src/components/CalendarWeekStrip.tsx` | Week strip of selectable local dates. |
| `src/components/DiaryCard.tsx` | Persisted day's diary summary. |
| `src/components/DiaryEditModal.tsx` | Diary form state, optional attributes, autosave-on-close and deletion. |
| `src/components/DiaryOptionChips.tsx` | Single/multiple choice chips for diary metadata. |
| `src/components/ErrorBoundaryScreen.tsx` | Recoverable application failure UI. |
| `src/components/FilterBar.tsx` | Text, resort, tag and date filters with input debounce. |
| `src/components/GpsConfirmationDialog.tsx` | Confirm grouped resort assignments after batch import. |
| `src/components/SkiResortSearch.tsx` | Resort search, suggestions, favorites and free text. |
| `src/components/TagChip.tsx` | Styled tag display and optional remove action. |
| `src/components/TagSelector.tsx` | Tag selection and custom-tag creation for a video. |
| `src/components/TechniqueSelector.tsx` | Technique choices plus selected historical names. |
| `src/components/ThumbnailMigrationScreen.tsx` | Blocking progress UI while poster files are repaired. |
| `src/components/VideoCardCompact.tsx` | Thumbnail-backed video row, favorite indicators, selection and swipe. |
| `src/components/WebAlertHost.tsx` | Browser-compatible alert queue and confirm dialog. |
| `src/components/dashboard/ActivityHeatmap.tsx` | Daily density chart with date drill-down. |
| `src/components/dashboard/DashboardSection.tsx` | Dashboard section wrapper and header action. |
| `src/components/dashboard/HorizontalBarChart.tsx` | Ranked horizontal comparison bars. |
| `src/components/dashboard/MonthlyBarChart.tsx` | Switchable monthly video/day bar chart. |
| `src/components/dashboard/SummaryCards.tsx` | Seasonal headline metrics. |
| `src/components/ui/GlassSurface.tsx` | Native Liquid Glass with safe opaque fallback. |
| `src/components/ui/GlassSurface.web.tsx` | Browser's opaque glass substitute. |
| `src/components/ui/Icon.tsx` | SF/Material symbols with mandatory text fallback. |
| `src/components/ui/PressableScale.tsx` | Animated press-in scale feedback. |

## Feature hooks

| Source file | Contract and responsibility |
| --- | --- |
| `src/hooks/useAppPreference.ts` | Read and update a string preference through focus-aware state. |
| `src/hooks/useAutosavedText.ts` | Debounced title/memo persistence, flush, status and seed semantics. |
| `src/hooks/useCalendarEnhanced.ts` | Calendar month/week state, day info and data refresh. |
| `src/hooks/useDashboard.ts` | Season selection, stats fetch and recent video enrichment. |
| `src/hooks/useDiaryEntry.ts` | Read, upsert and delete one diary by local date key. |
| `src/hooks/usePlaybackSource.ts` | Resolve reference/copy movie URI and availability/permission state. |
| `src/hooks/useSelectionMode.ts` | Selected-video set and transition into/out of bulk selection. |
| `src/hooks/useSkiResortSuggestions.ts` | Suggestions from date context, recents and stored resorts. |
| `src/hooks/useVideoDetail.ts` | One video row, tags and metadata mutation. |
| `src/hooks/useVideos.ts` | Filtered library refresh, batched tags and stable list updates. |

## SQLite database and repositories

| Source file | Contract and responsibility |
| --- | --- |
| `src/database/index.ts` | Native SQLite singleton, change listeners, foreign keys and WAL. |
| `src/database/index.web.ts` | Side-effect-free Web DB placeholder for route evaluation. |
| `src/database/schema.ts` | Canonical Drizzle tables, columns, constraints and inferable types. |
| `src/database/repositories/appPreferenceRepository.ts` | Key/value preference read, upsert and delete. |
| `src/database/repositories/appPreferenceRepository.web.ts` | Web preference substitute. |
| `src/database/repositories/dashboardRepository.ts` | Season rows, recent videos and earliest capture lookup. |
| `src/database/repositories/dashboardRepository.web.ts` | Web dashboard substitute. |
| `src/database/repositories/diaryEntryRepository.ts` | Diary per-day CRUD and range/presence queries. |
| `src/database/repositories/diaryEntryRepository.web.ts` | Web diary substitute. |
| `src/database/repositories/favoriteResortRepository.ts` | Saved resort-name persistence. |
| `src/database/repositories/favoriteResortRepository.web.ts` | Web resort preference substitute. |
| `src/database/repositories/tagRepository.ts` | Tags, many-to-many associations and transactional deletion. |
| `src/database/repositories/tagRepository.web.ts` | Web tag and association substitute. |
| `src/database/repositories/techniqueOptionRepository.ts` | Choice insertion, deletion and atomic reordering. |
| `src/database/repositories/techniqueOptionRepository.web.ts` | Web technique choice substitute. |
| `src/database/repositories/videoRepository.ts` | Library CRUD, search, date filters and favorite changes. |
| `src/database/repositories/videoRepository.web.ts` | Web video CRUD and filtering substitute. |
| `src/database/repositories/videoStorageRepository.ts` | Atomic legacy ownership backfill with version marker. |
| `src/database/repositories/videoStorageRepository.web.ts` | Web storage migration substitute. |
| `src/database/repositories/videoTransferJobRepository.ts` | Durable transfer-job persistence/atomic commit groundwork. |
| `src/database/repositories/videoTransferJobRepository.web.ts` | Web transfer-job substitute; not a live queue. |

## Resource and domain services

| Source file | Contract and responsibility |
| --- | --- |
| `src/services/bulkImportSummaryService.ts` | Volatile handoff of batch results to the Home screen. |
| `src/services/duplicateDetectionService.ts` | Pairwise movie similarity and connected-group computation. |
| `src/services/hapticsService.ts` | Error-tolerant haptic feedback boundary. |
| `src/services/hapticsService.web.ts` | No-op/compatible haptic behavior on Web. |
| `src/services/importService.ts` | Current movie import, owned file staging, DB insertion and rollback. |
| `src/services/importService.web.ts` | Browser import service unsupported substitute. |
| `src/services/managedVideoFileService.ts` | Managed movie directory, copy, relative-path resolution and delete. |
| `src/services/managedVideoFileService.web.ts` | Web managed-file substitute. |
| `src/services/mediaMutationCoordinator.ts` | Pure serial operation queue and cancellation groundwork, not universal runtime wiring. |
| `src/services/mediaPolicyService.ts` | Storage/network priority persistence primitives, not exposed by current UI. |
| `src/services/mediaPolicyService.web.ts` | Web priority persistence substitute. |
| `src/services/mediaService.ts` | Expo Photos permissions, asset lookup and download retry. |
| `src/services/mediaService.web.ts` | Browser Photos substitute. |
| `src/services/orphanCleanupRun.ts` | Pure orphan enumeration, protection and reread-before-delete protocol. |
| `src/services/orphanedFileCleanupService.ts` | Native file cleanup adapter and five-minute grace. |
| `src/services/orphanedFileCleanupService.web.ts` | Web cleanup substitute. |
| `src/services/storageMigrationService.ts` | Mandatory storage-mode backfill barrier at boot. |
| `src/services/storageMigrationService.web.ts` | Web storage migration substitute. |
| `src/services/thumbnailMigrationService.ts` | Legacy poster normalization and missing thumbnail recovery. |
| `src/services/thumbnailMigrationService.web.ts` | Web thumbnail migration substitute. |
| `src/services/thumbnailService.ts` | JPEG generation, path resolution and safe removal. |
| `src/services/thumbnailService.web.ts` | Web thumbnail substitute. |
| `src/services/updateCheckService.ts` | Optional App Store Lookup API version prompt. |
| `src/services/videoDeletionOrder.ts` | Pure DB-first record and owned-file deletion ordering. |
| `src/services/videoDeletionService.ts` | Connect deletion protocol to real DB and file adapters. |
| `src/services/videoStorageBackfill.ts` | Pure legacy reference/copy path backfill plan. |
| `src/services/videoTransferJob.ts` | Pure incomplete-transfer state machine and payload validation. |
| `src/services/videoTransferRecovery.ts` | Pure crash-reconciliation plan, currently not called on startup. |
| `src/services/videoTransferRunner.ts` | Pure injected verified-file promotion and DB-commit protocol. |

## Pure utilities and boundary rules

| Source file | Contract and responsibility |
| --- | --- |
| `src/utils/assetId.ts` | Synthetic Photos identity prefix recognition and creation rules. |
| `src/utils/bulkImportProgressUtils.ts` | Batch completion counts, phase labels and ETA/progress helpers. |
| `src/utils/calendarUtils.ts` | Local calendar grid/week math and day aggregation. |
| `src/utils/dashboardStats.ts` | Twelve-month season analytics aggregation. |
| `src/utils/dateUtils.ts` | Local dates, display formats and October–September seasons. |
| `src/utils/debouncedTask.ts` | Cancelable, flushable scheduled async work. |
| `src/utils/geoUtils.ts` | Haversine distance and nearby resort ranking. |
| `src/utils/managedVideoPath.ts` | Safe copy filenames, relative path generation and ownership validation. |
| `src/utils/mediaPolicy.ts` | Pure eligibility/intent/consent acquisition decisions. |
| `src/utils/parseTechniques.ts` | Defensive parsing of serialized technique names. |
| `src/utils/photosErrors.ts` | Distinguish Photos-origin errors for download retry. |
| `src/utils/playbackSource.ts` | Pure playback resolution and availability mutation decisions. |
| `src/utils/searchRouteParams.ts` | Validate and encode dashboard-to-search filter routes. |
| `src/utils/techniqueSeeding.ts` | Reconcile new default choices with prior user deletions. |
| `src/utils/thumbnailPath.ts` | Safe owned-JPEG path constraints. |
| `src/utils/versionUtils.ts` | Comparable app version parsing and ordering. |
| `src/utils/videoListEquality.ts` | Avoid unnecessary screen refreshes when normalized lists match. |
| `src/utils/videoStorageMode.ts` | Strict reference/copy value validation and normalization. |
| `src/utils/webAlertQueue.ts` | Browser alert queue transitions and resolution. |
| `src/utils/webDragClickGuard.ts` | Suppress click-through after mouse drag. |

## Constants, locale, types and Web mock

| Source file | Contract and responsibility |
| --- | --- |
| `src/constants/colors.ts` | Alpine Blue visual and semantic color tokens. |
| `src/constants/diaryOptions.ts` | Weather/snow/fatigue option registry. |
| `src/constants/icons.ts` | Central SF/Material symbol names. |
| `src/constants/motion.ts` | Spring and pressed-scale design tokens. |
| `src/constants/techniques.ts` | Default technique labels for first boot. |
| `src/i18n/index.ts` | Initialize device-derived Japanese/English locale and translator. |
| `src/i18n/locales/en.ts` | English user-visible string resource. |
| `src/i18n/locales/ja.ts` | Japanese user-visible string resource and type reference. |
| `src/i18n/types.ts` | Supported language union. |
| `src/i18n/useTranslation.ts` | React access to fixed device locale and translator. |
| `src/types/dashboard.ts` | Dashboard aggregate/season result contracts. |
| `src/types/index.ts` | Video, tag, diary, filter and import domain interfaces. |
| `src/types/media.ts` | Native/media adapter and transfer contract types. |
| `src/mocks/emptyModule.js` | Platform alias for unsupported native exports. |
| `src/mocks/webMockStore.ts` | Shared ephemeral browser simulation data. |

## Native media subsystem

| Source file | Contract and responsibility |
| --- | --- |
| `modules/snowlog-media/ios/Core/Sources/ChunkedFileCopier.swift` | Cancellable staged movie copy in bounded chunks. |
| `modules/snowlog-media/ios/Core/Sources/MediaFailureCode.swift` | Typed failure identifiers for native and JS parity. |
| `modules/snowlog-media/ios/Core/Sources/MediaRequest.swift` | Request token ownership, cancellation and callback finality. |
| `modules/snowlog-media/ios/Core/Sources/NetworkPathGate.swift` | Observable network-path eligibility gate. |
| `modules/snowlog-media/ios/Core/Sources/NetworkPathState.swift` | Native network-path value and Wi-Fi decision primitives. |
| `modules/snowlog-media/ios/Core/Sources/NoProgressWatchdog.swift` | Detect stalled acquisition by progress, not elapsed wall time alone. |
| `modules/snowlog-media/ios/Core/Sources/PreparationRules.swift` | Prepared-file validation, extensions and disk reserve checks. |
| `modules/snowlog-media/ios/Core/Sources/SnowLogMediaCore.swift` | Swift core aggregation entrypoint. |
| `modules/snowlog-media/ios/Core/Tests/SnowLogMediaCoreTests.swift` | XCTest of native media core rules. |
| `modules/snowlog-media/ios/Module/SnowLogMediaModule.swift` | Expo module boundary; only contract constant exposed at baseline. |

## Astro promotional website

| Source file | Contract and responsibility |
| --- | --- |
| `pr/web/src/components/AppHero.astro` | Hero, primary links and PV playback element. |
| `pr/web/src/components/FaqSection.astro` | Marketing FAQ presentation. |
| `pr/web/src/components/FeatureGrid.astro` | Feature cards. |
| `pr/web/src/components/HomeDocument.astro` | Full landing document, SEO and JSON-LD. |
| `pr/web/src/components/OfflinePrivacySection.astro` | Local-first and privacy narrative. |
| `pr/web/src/components/PrivacyDocument.astro` | Privacy policy and metadata. |
| `pr/web/src/components/ProblemSection.astro` | Product problem statement. |
| `pr/web/src/components/ScreenshotShowcase.astro` | Screen captures and descriptions. |
| `pr/web/src/components/SiteFooter.astro` | Reusable links and footer. |
| `pr/web/src/components/SnowBackground.astro` | Brand background treatment. |
| `pr/web/src/components/StatStrip.astro` | Marketing metric strip. |
| `pr/web/src/content.ts` | Japanese home and privacy copy data. |
| `pr/web/src/i18n.ts` | Typed content structure and canonical product links. |
| `pr/web/src/pages/index.astro` | Landing route. |
| `pr/web/src/pages/privacy.astro` | Privacy policy route. |
| `pr/web/src/styles/global.css` | Responsive site styling and visual tokens. |

## Remotion promotional film

| Source file | Contract and responsibility |
| --- | --- |
| `pr/pv/src/Root.tsx` | Register main and individual compositions with measured metadata. |
| `pr/pv/src/SnowLogPv.tsx` | Main timeline composition, scene audio, transitions and BGM. |
| `pr/pv/src/components/Caption.tsx` | Narration-driven on-screen captions. |
| `pr/pv/src/components/DeviceFrame.tsx` | Masked iPhone/screen device frame. |
| `pr/pv/src/components/ScreenScene.tsx` | Reusable screen-driven scene composition. |
| `pr/pv/src/components/SnowParticles.tsx` | Atmospheric particle overlay. |
| `pr/pv/src/components/transitions/SceneTransition.tsx` | Transition dispatcher/contract. |
| `pr/pv/src/components/transitions/SnowWipe.tsx` | Snow-cover transition. |
| `pr/pv/src/components/transitions/WhipPan.tsx` | Camera whip-pan transition. |
| `pr/pv/src/index.ts` | Remotion bundle entrypoint. |
| `pr/pv/src/scenes/S00Title.tsx` | Opening logo/title scene. |
| `pr/pv/src/scenes/S01Hook.tsx` | Hook/problem introduction. |
| `pr/pv/src/scenes/S02Grid.tsx` | Growing footage grid. |
| `pr/pv/src/scenes/S03Logo.tsx` | Product reveal. |
| `pr/pv/src/scenes/S04Import.tsx` | Import feature presentation. |
| `pr/pv/src/scenes/S05Record.tsx` | Tags and technique recording presentation. |
| `pr/pv/src/scenes/S06Calendar.tsx` | Calendar and diary presentation. |
| `pr/pv/src/scenes/S07Dashboard.tsx` | Season analytics presentation. |
| `pr/pv/src/scenes/S08Privacy.tsx` | Privacy/local-first presentation. |
| `pr/pv/src/scenes/S09Cta.tsx` | Closing call to action. |
| `pr/pv/src/script.ts` | Single source for spoken lines, captions and scene constraints. |
| `pr/pv/src/theme/colors.ts` | Film palette. |
| `pr/pv/src/theme/springs.ts` | Film spring motion presets. |
| `pr/pv/src/theme/typography.ts` | Film type styles. |
| `pr/pv/src/tiles.ts` | Visual tile model. |
| `pr/pv/src/timeline.ts` | Dynamic narration measurements and frame allocation. |
| `pr/pv/src/scenes.test.ts` | Scene registration/composition tests. |
| `pr/pv/src/script.test.ts` | Content script contract tests. |
| `pr/pv/src/tiles.test.ts` | Tile behavior tests. |
| `pr/pv/src/timeline.test.ts` | Frame allocation and timing tests. |

## Repository scripts

| Source file | Contract and responsibility |
| --- | --- |
| `scripts/patchImageUtilsCache.js` | Expo image cache patch run after dependency installation. |
| `scripts/release-testflight.sh` | Guarded EAS production build and TestFlight submission. |
| `scripts/reset-project.js` | Expo starter cleanup tool; not part of normal runtime. |
| `scripts/update_ski_resorts.py` | Resort data maintenance/update script. |
| `scripts/webSmoke.cjs` | Browser execution and route-marker smoke verification. |

## Node test suite

The root test runner discovers **45** top-level `scripts/tests/*.test.cjs` files. The additional helper `scripts/tests/helpers/repositoryHarness.cjs` implements reusable SQLite harness infrastructure rather than an independent test entrypoint. The suite is organized by file, not by one universal mock model.

| Test area | Files and representative assertions |
| --- | --- |
| Persistence and migrations | `appPreferenceRepository.test.cjs`, `deleteCustomTag.test.cjs`, `tagRepository.test.cjs`, `syncTransactions.test.cjs`, `migrationForeignKeys.test.cjs`, `repositoryHarnessDriver.test.cjs`, `repositoryHarnessMigrations.test.cjs` |
| Video storage, import and deletion | `assetId.test.cjs`, `assetLookup.test.cjs`, `bulkImportProgressUtils.test.cjs`, `managedVideoPath.test.cjs`, `thumbnailPath.test.cjs`, `videoDeletionOrder.test.cjs`, `orphanCleanupRun.test.cjs`, `videoStorageBackfill.test.cjs`, `videoStorageMigration.test.cjs`, `videoStorageMode.test.cjs` |
| Transfer/network groundwork | `mediaMutationCoordinator.test.cjs`, `mediaPolicy.test.cjs`, `mediaPolicyService.test.cjs`, `snowlogMediaContract.test.cjs`, `videoTransferJob.test.cjs`, `videoTransferJobRepository.test.cjs`, `videoTransferRecovery.test.cjs`, `videoTransferRunner.test.cjs`, `photosErrors.test.cjs`, `playbackSource.test.cjs` |
| User features and dates | `calendarUtils.test.cjs`, `dashboardStats.test.cjs`, `dateUtils.test.cjs`, `debouncedTask.test.cjs`, `duplicateDetectionService.test.cjs`, `geoUtils.test.cjs`, `homeSwipeDelete.test.cjs`, `parseTechniques.test.cjs`, `techniqueSeeding.test.cjs`, `videoDetailKeyboardAccessory.test.cjs`, `videoListEquality.test.cjs`, `videoSearch.test.cjs`, `versionUtils.test.cjs` |
| Web and localization | `i18nKeys.test.cjs`, `i18nPlural.test.cjs`, `webAlertQueue.test.cjs`, `webEmptyModules.test.cjs`, `webShimParity.test.cjs` |

For test names and exact assertions, consult the files and [Verification and releases](verification-and-release.md). A unit test for a pure transfer primitive does **not** imply the native player or import screen currently uses it.
