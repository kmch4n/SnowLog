# Home Library, Video Details, Playback and Safe Deletion

## Home library

`src/app/(tabs)/index/index.tsx` presents **All** and **Favorites** segments. It holds separate `useVideos` queries for all and `favoritesOnly` and refreshes on focus. A preference-backed sort picker selects `newest` (default), `oldest` or `resort`, with `buildSections` creating list sections. A video card displays a thumbnail/metadata summary, can open the details route, supports swipe delete and enters multi-select by long press.

The interaction model is:
- Tap normally -> `/video/<id>`.
- Long-press -> selection mode, initially selecting that card. Subsequent taps toggle selection.
- Bulk favorite action -> if every selected video is already favorite, unfavorite all; otherwise favorite all.
- Bulk delete -> localized confirmation, then `deleteVideosWithCleanup`.
- Swipe delete -> localized confirmation, then the same shared deletion service for one ID.
- Import button -> modal `/video-import`.
- On a completed batch import, Home consumes an **in-memory** summary (success, skip, error, inaccessible count) and presents it after interactions settle.
- An unsuccessful mutation preserves selection when useful and refreshes the relevant lists to reflect actual database state.

`useVideos` fetches filtered rows, hydrates tags with **one batched query** using `getTagsForVideos` and parses `techniques` JSON. Its filter/focus request guard discards late results from obsolete filters. List equality compares stable content to prevent unnecessary rendering. Favorites are stored as integer 1/0 in the video row.

## Video detail model

`src/app/video/[id].tsx` combines `useVideoDetail` (record CRUD and tags) with `usePlaybackSource` (physical source resolution), resort suggestions and two independent `useAutosavedText` instances.

| Field/action | Behavior |
| --- | --- |
| Video playback | `expo-video` player for a resolved URI, or unavailable/access-required placeholder |
| Title | User-edited nullable string, filename as input placeholder, **1-second** delayed autosave |
| Memo | Free text with 1-second delayed autosave; keyboard scroll accommodation |
| Resort | Editable via `SkiResortSearch`, persisted immediately |
| Techniques | Multi-select names, persisted as JSON string or null, immediately |
| Tags | Multi-select associations; excludes obsolete technique-tag UI representation; persisted immediately |
| Favorite | Immediate toggle and feedback |
| Capture timestamp | Read-only in this screen at baseline |
| Delete | Confirmation, shared record-first deletion, then navigate back |
| Photos shortcut | iOS-only if non-synthetic Photos identity and row currently marked available |
| Media metadata | Capture time and duration; when Photos dimensions are available, show resolution and resize player by aspect ratio |

A saved metadata field causes a **silent** record refetch; it must not unmount the video player or replace the other field while the user types. The title and memo inputs are seeded only when a *different video* arrives. Pending edits are flushed on navigation/unmount and flushed before changing the seeded video; after a confirmed deletion, pending saves are canceled so they cannot target a deleted row. The visual save status displays saving/saved when applicable.

## Source identity versus ownership

Never resolve a video based on `isSyntheticAssetId` alone. `storageMode` owns the decision:

| Mode | Resolution | Photos permission? | Failure behavior |
| --- | --- | --- | --- |
| `reference` | Query Photos identity (`assetId`), accept a returned `uri` (often `ph://`) or `localUri` | Required | Distinguish permission-limited vs full-access genuinely missing |
| `copy` | Resolve `managedVideoPath` against current app Documents container | **Not required** | Missing managed path/file -> no hidden fallback to Photos |

`usePlaybackSource` computes a stable source identity from video ID, `assetId`, `storageMode` and managed path. It does not restart resolution for every metadata autosave. It **attempts resolution even when `isFileAvailable = 0`**, so newly restored Photos authorization can recover a previously marked-unavailable video.

`decidePlaybackSource` is the pure decision table:

| Resolved URI? | Photos access | Previously available? | Result |
| --- | --- | --- | --- |
| Yes | Any | 1 | Play; no DB availability update |
| Yes | Any | 0 | Play; mark available 1 |
| No | `limited` or `none` | Any | Show access guidance; **do not** mark missing |
| No | `all` | 1 | Show missing; mark available 0 |
| No | `all` | 0 | Show missing; no DB write |

For `copy`, the hook evaluates with effective access `all` because a missing app-owned file cannot be explained by Photos authorization. Temporary thrown errors are caught and **do not** update availability. Stale async results are suppressed after source change/unmount.

**Current network limitation:** reference playback uses `getAssetInfoWithDownload`, which can retry with Photos network access after a native Photos error, then prefers Photos-provided `uri` for Expo Video. The future Issue #86 explicit per-play consent/network gate is **not wired into this flow yet**.

## Media file/path contract

- JPEG thumbnails live under `Documents/thumbnails/<video-id>.jpg`, recorded in the DB as a **relative path**; `""` is the missing sentinel.
- Managed movie copies live under `Documents/videos/<video-id>.<extension>`; path is also relative.
- `resolveThumbnailUri` re-bases legacy absolute paths when possible, but the persistent target format is relative.
- `buildManagedVideoPath` validates safe video IDs and filename-derived extension; `validateManagedVideoPath` enforces that the basename belongs to the row's ID. Do not replace these checks with naive concatenation of untrusted IDs.
- Thumbnail regeneration happens on startup migration when a source is locally accessible; lack of media may instead persist the sentinel.

## Safe deletion: row first, bytes afterward

All list/detail/duplicate actions must converge on `videoDeletionService.deleteVideoWithCleanup` / `deleteVideosWithCleanup`, whose ordering is implemented by pure `runVideoDeletion`:

1. Load each target row's owned thumbnail and managed movie path **without deleting anything**.
2. Build deferred file-deletion callbacks; do **not** start IO in this step.
3. Delete video rows and cascade video-tag links. If the DB operation throws, **no file deletion has begun**, leaving recoverable intact records.
4. Only after row deletion commits, execute file deletion callbacks using `Promise.allSettled`. Any deletion failure can leave an orphan file, not a live row pointing at removed media.
5. Report database delete success even if a later file deletion fails; background/manual orphan cleanup can retry filesystem cleanup.

A confirmation dialog is a UI policy; the record-before-files order is a **data-integrity invariant** regardless of UI.

## Orphan cleanup and race guards

`cleanupOrphanedFiles` scans only app-owned `thumbnails/` and `videos/` and compares filesystem entries with references held by current `videos` rows. It runs non-blocking on startup and on explicit Settings action. Its policy is in `orphanCleanupRun`:

- A thumbnail is referenced by the stored thumbnail path.
- A movie is owned by a valid `copy` row's `managedVideoPath`; a pathless legacy copy ID is treated conservatively to avoid deleting a potentially recoverable file.
- Skip files modified within the **last five minutes** (protection against cleanup racing with a new import/commit).
- Honor in-process explicit `protectFilesFromOrphanedCleanup` protection during imports.
- Compute references, inspect candidate files, and recheck references/protection before deletion. If protection changes or a new reference appears, do not delete.
- Delete only unreferenced candidates, aggregate removed thumbnail count, managed-video count and bytes.

A design that permanently stores independent files in these directories without a corresponding video-row ownership reference is incompatible with cleanup. New durable media must either be referenced or stored outside these cleanup targets with a deliberate owner/recovery policy.

## Failure modes and known limits

- If a Photos item is deleted or library permissions change, metadata entry remains; playback may stop.
- Missing local copy must not silently fall back to an unrelated Photos item; no automatic restore/recreate path currently.
- Device restore may invalidate Photos IDs (#85); copied media may survive iCloud Backup when included, while references may need relinking.
- An unavailable bit is a cache updated from resolution results, not a substitute for checking again.
- File system operation errors may leave temporary/orphan files that maintenance eventually cleans.
- Persistent transfer jobs and crash recovery infrastructure exist but are not yet part of the shipping import UI; do not represent them as a guaranteed route-level recovery system.

**Evidence:** `src/app/(tabs)/index/index.tsx`, `src/app/video/[id].tsx`, `src/hooks/useVideoDetail.ts`, `src/hooks/usePlaybackSource.ts`, `src/hooks/useAutosavedText.ts`, `src/services/videoDeletionOrder.ts`, `src/services/videoDeletionService.ts`, `src/services/orphanCleanupRun.ts`, `src/services/orphanedFileCleanupService.ts`, `src/utils/playbackSource.ts`, `scripts/tests/videoDeletionOrder.test.cjs`, `scripts/tests/playbackSource.test.cjs`.
