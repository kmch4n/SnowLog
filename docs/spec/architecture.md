# Architecture, Ownership, and Runtime Boundaries

## Dependency structure

```text
iOS: Expo Router screens (src/app)
  ├─ presentational components (src/components)
  ├─ feature hooks (src/hooks) ──> repositories (src/database/repositories)
  │                                  └─ Drizzle/Expo SQLite singleton (src/database)
  ├─ services (src/services) ─────> Photos / file system / platform APIs
  ├─ pure rules (src/utils) and types (src/types)
  └─ localization (src/i18n), colors/motion/icons (src/constants)

iOS native groundwork (modules/snowlog-media)
  ├─ Expo module (currently exports a contract-version constant only)
  └─ Swift core rules, request tokens, path monitoring and file copying

Browser preview: .web.ts(x) files ──> in-memory WebMockStore
Companion projects: pr/web (Astro), pr/pv (Remotion)
```

**Contract direction:** screens orchestrate user interactions and route transitions; hooks coordinate state and refresh; repositories own persisted relational changes; services own resource side effects; pure utilities own testable decisions. This is an architectural intent as well as a description: existing `video-import.tsx` is a documented exception (large, UI-bound orchestration; Issue #80), not a desired template for new screens.

## Routing and navigation

| Route / entry | Responsibility and key dependencies |
| --- | --- |
| `src/app/_layout.tsx` | Native root, migration gates, background tasks and stack registration |
| `src/app/_layout.web.tsx` | Browser root, no SQLite startup, Web alert/drag guards |
| `src/app/(tabs)/_layout.tsx` | `NativeTabs` for Home, Dashboard, Calendar, Search, Settings |
| `(tabs)/index/index.tsx` | Library sections, sort, favorites, selection, deletion, import navigation |
| `(tabs)/dashboard/index.tsx` | Season chooser, dashboard charts, drill-down to search |
| `(tabs)/calendar/index.tsx` | Month/week navigation, video list and diary modal |
| `(tabs)/search/index.tsx` | Search filters and result list |
| `(tabs)/settings/index.tsx` | Settings subroutes and orphan-file maintenance |
| `video-import.tsx` | Native single/bulk Photos-picker workflows |
| `video/[id].tsx` | Native player and editable metadata |
| `settings/*.tsx` | Calendar, techniques, favorite resorts, custom tags, duplicate candidates |

Each tab has a nested `_layout.tsx` controlling its header. The native tab bar uses SF Symbols on iOS and Material icons as fallbacks. Explicit Web route companions exist for the importer and video detail.

## State ownership

- SQLite is the durable source for videos, labels, diaries, preferences, and transfer-job rows. It is **not** a remote database.
- The Photos library owns the original movie for `storageMode = "reference"`. The DB stores its `assetId` and metadata. SnowLog owns the JPEG poster even for reference records.
- The local Documents directory owns movies for `storageMode = "copy"`, addressed by validated relative paths. A `synthetic:` asset ID is an identity fallback, **not** a general storage-policy discriminator once migration columns exist.
- `bulkImportSummaryService` is an ephemeral process-local handoff. It survives navigation to Home, not process termination.
- Screen state such as selection mode, dialog visibility and active filters normally lives in the relevant hook or screen, not in SQLite; saved Home sort and week start are exceptions.
- Web preview state is the single `src/mocks/webMockStore.ts` instance and should not be described as persistent app data.

## Main read/write sequences

**Read a video list:** `useVideos` reads `videoRepository.getVideosByFilter`, batches tag associations with `getTagsForVideos`, converts serialized techniques through `parseTechniques`, normalizes storage mode, and avoids unnecessary re-rendering through `areVideoListsEqual`. Refresh is focus-triggered and can discard stale async results.

**Read detail:** `useVideoDetail` gets the row and tags. The player source is resolved independently by `usePlaybackSource` so a title/memo autosave does not restart playback. Edited fields route back through repositories; detail refetches without unmounting the player during saves.

**Write imports:** `video-import.tsx` currently drives the system picker and stages a local movie; `importService.importVideo` generates a thumbnail, creates the row, associates tags, and rolls back owned files when persistence fails. The planned Swift-based acquisition pipeline is **not wired** to this screen.

**Delete:** `videoDeletionService` delegates to the pure `videoDeletionOrder.runVideoDeletion`: collect paths → delete DB rows → attempt file cleanup. The order is critical to preserve recoverability.

**Compute dashboard:** `dashboardRepository` selects rows for the season; `dashboardStats.buildDashboardStats` performs pure in-memory aggregation; `useDashboard` enriches recent items with tags.

## Cross-cutting modules

| Concern | Owner | Rule |
| --- | --- | --- |
| Navigation | Expo Router, `src/app` | Use typed route parameters; validate dashboard-to-search links |
| Persistence | `src/database/index.ts` + repositories | Drizzle uses SQLite with foreign keys and WAL; do not edit generated migrations |
| Import/media | `src/services/importService.ts` and related services | File ownership and cleanup must be explicit |
| Date/season | `src/utils/dateUtils.ts` | Local-day keys; October–September season |
| GPS | `src/utils/geoUtils.ts` | Haversine distance against bundled catalog |
| Localization | `src/i18n` | Device-language fixed on module initialization |
| Haptics | `src/services/hapticsService.ts` | Only public wrapper; no direct Expo haptics imports |
| UI palette | `src/constants/colors.ts` | One token registry; no second palette |
| Motion | `src/constants/motion.ts` | Spring presets; honor reduced-motion behavior |
| Web/native parity | `*.web.ts(x)` and tests | TypeScript alone does not verify Metro's platform resolution |

## Dependency traps

1. `drizzle/` files are generated. Schema changes belong in `src/database/schema.ts`, followed by migration generation and inspection.
2. SQLite transaction callbacks in the shipping Expo driver must execute database operations **synchronously** with `.run()`/`.all()`. An `async` callback may commit before later awaited statements, breaking intended atomicity.
3. Web's route loader evaluates modules it does not render. Any reachable native-only import needs a safe Web entrypoint, even if there is a `_layout.web.tsx`.
4. File deletion and orphan cleanup must respect `storageMode`/`managedVideoPath` rather than infer ownership only from an asset ID prefix.
5. The startup storage backfill is a barrier **before** thumbnail migration and cleanup; see [Startup and maintenance](startup-and-maintenance.md).
6. Unwired native/media helpers are reusable building blocks but **not active transport policy**.

## Sources

`src/app/_layout.tsx`; `src/app/(tabs)/_layout.tsx`; `src/hooks/useVideos.ts`; `src/hooks/useVideoDetail.ts`; `src/hooks/usePlaybackSource.ts`; `src/database/index.ts`; `src/services/importService.ts`; `src/services/videoDeletionOrder.ts`; `src/services/mediaMutationCoordinator.ts`; `.memory/wiring.md`.
