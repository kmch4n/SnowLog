# Product Scope and Current Delivery Status

## Product contract

SnowLog organizes skiing and snowboarding videos as a personal practice log. It joins a video with its filming date, ski resort, technique labels, tags, user title and memo; provides daily diary context; and makes those records searchable through a library, calendar, and seasonal dashboard. The central use case is finding and comparing practice footage that would be hard to retrieve by date alone in Photos.

**User-facing screens:** Home, Dashboard, Calendar, Search, Settings, a modal video importer, video detail, settings subpages, and a diary editor. The main tab navigator is in `src/app/(tabs)/_layout.tsx`. Feature descriptions below describe the iOS code, not merely marketing copy.

## Supported runtime and dependencies

| Property | Code-level fact |
| --- | --- |
| App version | `1.4.0` in `package.json` and `app.json`; do not infer the currently approved App Store version from this |
| Runtime | Expo SDK 55, React Native 0.83.x, React 19.2, Expo Router, strict TypeScript |
| Primary platform | iOS; `app.json` declares `com.kmch4n.snowlog`; public-facing metadata states iOS 16+ |
| Development | EAS development/native build; Expo Go is not a substitute for this project's native dependencies |
| Storage | Local SQLite through Expo SQLite + Drizzle, Photos asset references and app-owned files |
| Localization | Japanese and English; language derives from device preference at initialization |
| Web | Expo Web **preview** using Web shims and an in-memory store, not a data-synchronized client |
| Android | Configuration exists, but the released product does not claim Android support |
| Website | Separate Astro project in `pr/web/`, with a deployment target at `snowlog.kmchan.jp` |
| Promotional film | Separate Remotion project in `pr/pv/`; not a dependency of the mobile runtime |

Check `package.json`, `app.json`, and `eas.json` for exact current versions and build profiles instead of duplicating dependency pinning across specs.

## Implemented iOS capabilities

- Import one video with editable metadata or import up to **20 videos** in a sequential batch. Duplicate Photos asset identifiers are detected. Progress, per-item outcomes and optional post-import GPS-resort confirmation are present.
- Suggest resorts from metadata GPS coordinates against the bundled resort catalog, with manual selection and same-day/recent suggestions. The nearest result is not always silently applied.
- List stored videos in Home, switch all/favorites, choose sorting or resort grouping, swipe to delete, and long-press into multi-selection for favorite changes and deletion.
- Edit title, memo, resort, technique list, tags, and favorite flag in video detail. Playback uses either a Photos URI or an app-managed local file, depending on the row's storage mode.
- Search by filename/title/memo and combine resort, tags, date limits and favorite filters.
- Browse calendar months and weeks, inspect the selected day's videos, and create/update/delete one diary entry per local date.
- Inspect 12-month season metrics, including days, counts, durations, resorts, techniques, trends, heatmap and recent videos.
- Configure calendar week start, technique choices/order, saved resorts and custom tags; inspect and remove duplicate candidates; explicitly clean orphaned files.
- Recover from some old thumbnail and storage-column formats on launch; optionally notify about a newer App Store version.

## What is **not** delivered as a complete user feature

| Topic | Present state | Primary record |
| --- | --- | --- |
| User-selectable storage/data priority | Persistence/policy primitives exist; selection UI and import/playback integration are **not connected** | [Media-priority infrastructure](media-priority-infrastructure.md), Issue #86 |
| New native PhotoKit import adapter | Foundation classes and Expo constant-only module exist; picker/metadata/preparation API is **not implemented** | Issue #86 Task C |
| Foreground durable transfer queue | Schema/state machine/runner/recovery primitives exist; no connected write/queue UI in shipping import flow | Issue #86 Tasks D–G |
| Cross-device Photos re-link | Not implemented; iCloud device backup alone does not reconnect all Photos IDs | Issue #85 |
| Capture-date editor | Existing date repair is automated, not a user editing control | Issue #93 |
| Android product | Not supported | Product scope |
| Server sync, login, analytics SDK | Not part of the app | Repo dependency and architecture review |
| Independent JSON export/restore | Removed for 1.4.0; older documents may discuss it historically | Issue #90, `README.md` |

Open issues are **proposals or defects**, not current behavior. An open Issue may contain a mixture of already completed sub-tasks and remaining work; inspect its status section and callers before describing a feature as shipped.

## Privacy, offline behavior, and retention

- Video metadata, tags, diaries, and preferences live in local SQLite. Reference-mode movies reside in the user's Photos library rather than in a SnowLog server.
- Imported synthetic-ID videos must have a managed copy to remain playable. Reference-mode playback and picker resolution **may trigger iCloud network activity**, so "offline-first" does **not** mean every cloud-only Photos movie is offline playable.
- The app's optional update lookup contacts Apple's lookup API. Other network behavior can be initiated indirectly by Photos or by explicit external-link interactions.
- No app-specific JSON backup/export is available. Apple iCloud **device backup** may include the app's Documents; availability and restoration are OS-controlled. Uninstalling the app loses its container and cannot be reversed by simply reinstalling.
- Deleting an app record does not delete the original photo/video in Photos. It does remove SnowLog-managed poster and owned-copy files when present.

## Important user-visible constraints

- Limited Photos access is distinct from a missing file. The importer prevents confirmed out-of-selection references; playback shows an access state instead of permanently marking the movie missing.
- A Photos identifier may cease to resolve after migration to another phone. Re-linking is an outstanding feature; do not promise uninterrupted playback after restoring onto another device.
- The resort catalog contains **378 resorts** according to the current README/site content, but the actual catalog is `src/constants/skiResorts.json`; counts and coordinates must be verified there after updates.
- User-authored notes and tags survive ordinary app restarts; Photos availability can change independently.
- "Promotional website source contains a video" is **not** proof that the currently deployed site hosts it. Production deployment is a separate operation.

## Sources

`src/app/(tabs)/_layout.tsx`; `src/app/video-import.tsx`; `src/services/importService.ts`; `src/hooks/usePlaybackSource.ts`; `src/database/schema.ts`; `src/utils/dateUtils.ts`; `src/app/_layout.tsx`; `README.md`; `package.json`; Issue #86, #85, #90 and #93.
