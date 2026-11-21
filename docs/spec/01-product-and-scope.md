# Product Scope, Capabilities and Release Boundaries

**Baseline:** app 1.4.0, `main` `848264a`. **Audience:** engineering, QA, maintainers.

## Product problem and value

SnowLog is an iPhone application for reviewing skiing and snowboarding **videos as structured training records**. The primary unit is an imported video annotated with resort, skiing techniques, free-form tags, title, memo, time and favorite status. A calendar, daily diary and seasonal dashboard turn those videos into a personal record. Users should not have to repeatedly hunt through the system Photos library to find a run from a particular resort or practice session.

This is a **local-first catalog**, not a computer-vision analyzer, automatic run recorder, cloud social network, or streamed media platform. The sister project SkiSense is a potential future integration, not part of SnowLog's current runtime.

## Runtime / distribution boundary

| Property | As-built status and evidence |
| --- | --- |
| App UI | React Native, Expo Router, five tabs: Home, Dashboard, Calendar, Search, Settings — `src/app/(tabs)/_layout.tsx` |
| Target product | iOS/iPhone, iOS 16+ claimed by public README; `app.json` sets `supportsTablet: false` |
| App version | 1.4.0 in `app.json` / `package.json`; EAS manages remote build increments |
| Languages | Japanese and English, resolved from the device at startup; no in-app language switch |
| Primary database | On-device SQLite via Expo SQLite and Drizzle; no account/server-side video metadata |
| Video source | Photos library reference by default for identified Photos assets; app-owned copy for synthetic imports |
| Local files | App-owned JPEG thumbnails and any managed movie copies |
| Network | Photos/iCloud operations as invoked; optional App Store version lookup; static site hosted separately |
| Privacy | No app account, analytics/ads SDK, or dedicated application sync backend is present in the inspected package dependencies |
| Web | Preview and test harness, with in-memory data and platform stubs — not production storage |
| Android | Expo package identifier exists, but no supported Android release/feature parity |
| Companion artifacts | Astro landing site in `pr/web`; Remotion PV in `pr/pv` |

The presence of an Android entry point or a Web target in configuration is **not** a statement that those platforms are supported for end users.

## Shipped user journeys

**Import and annotate:** select one video, obtain Photos metadata when accessible, stage the file, preview, enter title/resort/techniques/tags/memo, save a catalog row. A separate batch picker accepts up to **20** videos, imports serially, reports per-item progress, detects candidate resorts using GPS, offers group confirmation and reports successes/skips/failures.

**Browse:** all/favorites Home segments; sort by newest, oldest or resort; tap to open detail, swipe-delete, long-press to select multiple entries; bulk favorite/unfavorite or delete.

**Review:** play available source, edit title/memo with delayed autosave and flush, modify resort/techniques/tags immediately, toggle favorite, delete with confirmation. The detail screen separates insufficient Photos authorization from a confirmed missing source.

**Find:** query by title/filename/memo, resort, one or more tag IDs, dates and favorite status at repository level. Search UI exposes text, resort, tag and date-presets; charts can deep-link to Search with filters.

**Reflect:** calendar month/week with video counts, resort dots, thumbnails and diary markers; diary per local date with resort, weather, snow conditions, impressions, temperature, companions, fatigue, expenses and number of runs. Dashboard shows season summary, resort ranking, technique distribution, month trend, activity heatmap and recent videos.

**Maintain:** manage techniques (including order), custom tags, favorite resorts and first-weekday preference; inspect potential duplicates; manually remove orphaned files. Some maintenance/repair also runs on startup.

## Explicit exclusions and limitations

- No remote SnowLog account, metadata sync, collaborative library, public feed or data analytics backend.
- No in-app JSON export/restore: retired in v1.4.0 (Issue #90). Earlier documentation and obsolete issue prose may mention it historically.
- No promise that merely reinstalling the app restores user data. The OS may include app `Documents` in iCloud Backup, but restoration is a **device setup** process subject to device settings and Apple behavior.
- No complete cross-device Photos asset relinking: see #85. A restored database may refer to an asset ID not valid on the replacement phone.
- No guaranteed offline replay for **reference** videos that exist only in iCloud. Locally managed copy videos are distinct.
- No user-operational storage/data priority picker or finished controlled PhotoKit pipeline yet; Issue #86 covers this work.
- No standalone capture-date editing UI yet (#93).
- No claim that every open UX issue is fixed: #45–47, #69, #70 and #80 remain separately tracked.

## Product and engineering invariants

1. Catalog metadata survives the disappearance of a Photos asset; missing playback does not silently delete the entry.
2. Copy ownership must not depend on whether the Photos ID happens to be synthetic (see `storageMode`).
3. A batch duplicate asset ID cannot silently create a second row.
4. Import and deletion error handling must prefer recoverable orphan files over database rows claiming missing content.
5. Individual-user information lives on-device; do not introduce external transfer of titles, diary, coordinates or video bytes without an explicit change in product contract.
6. A browser preview may demonstrate interactions but must never be described as the iOS storage/media implementation.

## External dependencies

- Photos/PhotoKit mediated by Expo packages in the shipping path; iCloud video availability and authorization are outside the app's control.
- App Store Lookup API for an optional update prompt (no user record upload by SnowLog's own implementation).
- EAS Build/App Store Connect for distribution; the Astro site does not host user data.

**Implementation anchors:** `app.json`, `package.json`, `src/app/(tabs)/`, `src/app/video-import.tsx`, `src/app/video/[id].tsx`, `src/services/`, `src/database/schema.ts`, `README.md`. **Related documents:** [02-system-architecture.md](02-system-architecture.md), [04-import-and-location.md](04-import-and-location.md), [08-media-infrastructure.md](08-media-infrastructure.md).
