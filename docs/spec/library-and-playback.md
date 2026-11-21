# Library, Playback, File Ownership, and Deletion

## Overview: one video record, two possible sources

Each library item is a row in `videos`, whose `storage_mode` determines who owns the **movie bytes**. The app always owns the SQLite metadata and any saved JPEG thumbnail. The Photos identity (`asset_id`) is a separate property, not proof of where the movie currently resides.

| Storage mode | Movie source | Stored movie bytes | Permissions and lifecycle |
| --- | --- | --- | --- |
| `reference` | Photos asset identified by `assetId` | No persistent full-movie copy in the SnowLog Documents directory | May need Photos permission and iCloud acquisition during playback |
| `copy` | Validated relative `managedVideoPath` under `Documents/videos/` | Yes | Resolve independently of Photos; never silently fall back to Photos when missing |

A synthetic identity (`synthetic:` prefix) is generated when the importer receives no Photos ID. **The active importer** creates a managed copy for that case. Older records are backfilled on startup. Do not later use `isSyntheticAssetId` in place of `storageMode` when deciding playback source, ownership or deletion.

## Library presentation and navigation

`src/app/(tabs)/index/index.tsx` uses `useVideos` for the full library and the favorites-only view. Rows are divided into resort sections; a sentinel denotes videos without a resort. Sorting is persisted as `home_sort_order`:

- `newest`: newest capture dates first, including section ordering.
- `oldest`: oldest dates first; resort sections and their video arrays are reordered.
- `resort`: resort-name based grouping/ordering rather than recency ordering of sections.

The route renders `VideoCardCompact` items, navigates to `/video/[id]` on tap and `/video-import` from its floating action. Long-press enters `useSelectionMode` and initializes the selected set; tapping selected videos toggles membership, and deselecting the last item exits. An explicit toolbar supports bulk favorite changes or bulk deletion. Swipe deletion requires user confirmation. Both deletion paths use the **same** cleanup service.

`useVideos` loads on focus, reads matching rows, fetches tags in one batch, decodes technique names, and normalizes storage mode. It uses `areVideoListsEqual` to avoid replacing an unchanged list. Async results from a no-longer-active filter are discarded.

## Detail and metadata editing

`src/app/video/[id].tsx` uses `useVideoDetail` and `usePlaybackSource` separately. The metadata route supports user title, memo, resort name, techniques, tags and favorite changes, together with deletion. The displayed duration and capture date are derived from persisted metadata or resolved asset information. The screen can offer to open Photos only when the media identity supports that action.

- Title and memo use `useAutosavedText`: after **1000 ms** without input, a write is scheduled. Pending writes are **flushed** on unmount; seeding fetched text does not schedule a write. A saved indicator persists briefly (2000 ms). Persistence failure returns to idle while keeping entered text.
- `useVideoDetail.updateVideoMeta` writes selected fields and `updatedAt`. Technique selections are serialized to JSON text; tags are replaced transactionally through `setTagsForVideo`.
- The detail hook refreshes the row without showing the initial loading state on each save. The player-source hook depends only on playback identity/storage fields, avoiding video player reset when text is autosaved.
- A deleted technique option can remain attached as a historical value, displayed by `TechniqueSelector` until the user removes it.

**No general-purpose user capture-date editor exists** in the current detail screen. Invalid-date repairs at startup are a separate maintenance operation; Issue #93 tracks explicit editing.

## Playback-source resolution

`usePlaybackSource` resolves a row even if `isFileAvailable` currently equals 0, allowing a successful lookup to restore availability after permissions or media have changed.

### Managed copy

1. If `storageMode === "copy"`, do not contact Photos.
2. If `managedVideoPath` is null or cannot be resolved to an existing file, show the missing-source state.
3. Otherwise pass the app-owned file URI to the player.
4. Do not substitute a Photos asset after a missing copy: that would silently alter the user's effective storage semantics.

### Photos reference

1. Request/check Photos privilege via `requestPhotosAccess`, obtaining `all`, `limited` or `none`.
2. If access is not `none`, use `getAssetInfoWithDownload(assetId)`. This existing Expo path may retrieve cloud media; it is **not** the future controlled network-policy adapter.
3. Prefer `info.uri` (often a Photos-backed `ph://` URI) over `localUri` where supplied; capture width, height and duration for playback layout.
4. Feed resolution outcome and access privilege into `decidePlaybackSource`.

### Availability decision

| Result | UI | Database update |
| --- | --- | --- |
| Source resolved; previously available | Play | No availability change |
| Source resolved; previously flagged unavailable | Play | Set `is_file_available = 1` and refresh |
| No source; full Photos access (or missing managed copy) | Missing movie | Set `is_file_available = 0` if it was 1 |
| No source; Photos access is limited or denied | Access/permission guidance | **Do not** mark missing |
| Temporary exception during resolution | No active URI until a future attempt | Do not overwrite persisted availability |

`decidePlaybackSource` implements the pure outcome rules in `src/utils/playbackSource.ts`. A limited-selection restriction is **not** equivalent to deleting the underlying asset. The player component uses `expo-video`; any subsequent playback network request is subject to the underlying Expo/Photos behavior in this baseline.

## Thumbnail ownership and representation

- A permanent thumbnail is a JPEG saved as `Documents/thumbnails/<video-id>.jpg` from the movie's initial frame (time 0, nominal quality 0.7).
- `videos.thumbnail_uri` stores `thumbnails/<video-id>.jpg`, **not** a container-specific absolute URI. `resolveThumbnailUri` rebases against the current Documents path.
- Empty string is the `THUMBNAIL_MISSING_SENTINEL`. The UI uses a placeholder; cleanup treats it as no owned poster.
- Import preview still images are temporary first-frame files (nominal quality 0.5), not persisted video thumbnails.
- Older absolute thumbnail URIs are normalized through `toRelativeThumbnailPath`; missing thumbnails are regenerated when a source resolves, otherwise the sentinel is written.
- `deleteThumbnail` accepts only canonical, safe immediate children of `thumbnails/` (see `isSafeThumbnailPath`) and rejects other paths to prevent accidental deletion beyond its directory.

## Managed movie path ownership

- Managed movies live under `Documents/videos/` as `videos/<video-id>.<extension>`.
- `buildManagedVideoPath` validates the video ID before creating a relative name. A restored or malformed ID is not trusted as a filesystem path.
- `validateManagedVideoPath` checks that the basename matches the owning video ID, allowing legacy alphanumeric extensions. The future acquisition writer narrows **new outputs** to MOV/MP4/M4V without invalidating legacy files.
- A `copy` row with no safe managed path is marked unavailable during storage backfill. The cleanup logic preserves its matching filename for manual recovery; it does not fabricate a path.
- The DB has a case-insensitive unique index on managed paths, preventing two active rows from owning one case-insensitive filesystem entry.

## Deletion is deliberately DB-first

`videoDeletionService.deleteVideoWithCleanup` and `deleteVideosWithCleanup` call `videoDeletionOrder.runVideoDeletion`:

1. Read the affected video rows and collect **path descriptions**, without invoking any file deletion.
2. Delete the SQLite row(s) and associated tag links first.
3. Only after DB deletion succeeds, attempt thumbnail and managed-file deletion with `Promise.allSettled`.

If the DB delete fails, no file deletion has begun, so the original record and bytes can still be retried. If file deletion fails after row deletion, the result is an orphaned file that maintenance can remove; it is **not** a live record pointing at deleted bytes. The user's Photos original is never deleted by this process.

## Orphan cleanup and concurrency

`orphanedFileCleanupService.cleanupOrphanedFiles` scans the immediate files in `thumbnails/` and `videos/` and compares them with live DB references using `orphanCleanupRun`. Its contract has several safety mechanisms:

1. **Five-minute minimum-age grace** for unreferenced files, guarding recently generated files before the DB write.
2. `protectFilesFromOrphanedCleanup` temporarily protects active importer destinations.
3. Candidate paths are first enumerated, then protection checked synchronously, then **live DB references re-read** immediately before deletion. This recheck is essential if an import committed after the first enumeration.
4. A pathless copy row's identity is used to preserve a potentially recoverable movie despite lacking a bound managed path.
5. Only unreferenced, old enough, unprotected files are deleted. The result reports removed thumbnails, movies and reclaimed bytes.

Cleanup runs non-blocking after startup and is also available as a guarded, confirmation-based Settings action. The generic media-mutation coordinator exists as infrastructure but is not yet universally used by these shipping operations; do not falsely claim all file modifications are globally serialized.

## Backup and device restore constraints

The database, thumbnails and managed copies are in the app's Documents container and can be part of **iCloud device backup** if the user has it enabled and OS conditions allow it. This is not SnowLog-managed automatic iCloud sync and has no in-app restore button. Photos references can fail after device restore even if the metadata DB is restored: a different device's Photos identifiers may not match. Cross-device relinking is Issue #85.

## Sources

`src/app/(tabs)/index/index.tsx`; `src/app/video/[id].tsx`; `src/hooks/{useVideos,useVideoDetail,usePlaybackSource,useAutosavedText,useSelectionMode}.ts`; `src/services/{importService,managedVideoFileService,thumbnailService,videoDeletionService,videoDeletionOrder,orphanedFileCleanupService,orphanCleanupRun}.ts`; `src/utils/{managedVideoPath,thumbnailPath,playbackSource}.ts`; `src/database/schema.ts`.
