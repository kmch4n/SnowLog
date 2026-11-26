# Video Import, Photos Permissions, and Ski Resort Resolution

## Current active implementation

The iOS import route is `src/app/video-import.tsx` (approximately 1,400+ lines in the reviewed revision). It coordinates the Expo ImagePicker, Photos metadata, local staging, record creation and bulk UI. The media-policy and native-module prototypes under Issue #86 are **not** the current import path.

**Import source:** `expo-image-picker` with `mediaTypes: ["videos"]`, `allowsEditing: false` for a single pick, and `shouldDownloadFromNetwork: true`. Multi-select uses `allowsMultipleSelection`, `orderedSelection` and `selectionLimit: 20` with passthrough video export. The picker can materialize cloud-backed media before it returns to JS; the import UI cannot provide transport-level guarantees today.

## Single-video sequence

1. Request media-library permission with `ImagePicker.requestMediaLibraryPermissionsAsync` and query the actual `all`/`limited`/`none` privilege via `mediaService.requestPhotosAccess`. Denial shows a permission alert.
2. Launch the system picker. The user may cancel. Picker/Photos failures show a contextual alert (including iCloud-specific failures).
3. If the result has an `assetId`, call `getVideoByAssetId`. An existing row produces a cancel/edit-existing choice rather than a duplicate row.
4. Invalidate older in-flight selections with `pickGenerationRef`. Reset the form, clear previous staging and query `lookupAssetWithDownload` for metadata. Use a genuine Photos creation time when available; extract GPS into resort candidates.
5. Under **limited** access, an existing ID with an explicit `notFound` lookup is treated as outside the authorized selection (`isOutsideLimitedSelection`); do **not** create an unplayable reference row. Offer Settings and cancellation. A generic lookup error is not sufficient proof.
6. Stage the selected `file://` or `content://` URI into `cacheDirectory/video-import/` using `FileSystem.copyAsync`. Unsupported/failed staging blocks Save. Generate an actual first-frame preview with `createPreviewThumbnail`, not an `Image` pointed directly at a movie URI. The preview is a temporary JPEG; it shares the staged copy's lifetime (see below).
7. The user can edit title, resort, techniques, tags and memo before Save. Capture date resolution prioritizes EXIF `DateTimeOriginal`, then Photos `creationTime`, then current time as last resort.
8. Generate a synthetic identifier (`synthetic:` + UUID) only if the picker supplies no Photos ID. Pass source metadata into `importService.importVideo`.
9. `importVideo` creates a video UUID, possibly retains a managed movie (for synthetic IDs), generates the permanent JPEG, inserts the video row, and attaches tags. An absent title becomes a localized capture timestamp. Failed writes attempt row/file cleanup.
10. If the selected resort came from GPS, optionally offer to assign that resort to other **unassigned** videos shot on the same local day. Clear staging and return to the previous screen.

A stale picker result cannot overwrite a newer selection. When staging or preview generation returns after the user has chosen another movie, its file is deleted.

The staged copy and the preview JPEG of the current pick are tracked together (`createPickScratchFiles`) and deleted together when the user picks another movie, after a successful Save, and when the screen closes. A failed Save keeps both so the user can retry. The modal prevents accidental navigation away during active saving.

## Batch sequence (up to 20)

1. Enter a `preparing` UI **before** launching the picker: it may remain open while the user browses and while iCloud materializes the selection. The 500 ms preparation spinner delay avoids a flash; elapsed import time must not include browsing.
2. Resolve all selected IDs and fetch previously imported IDs in one query. Existing IDs are `skipped`; missing IDs get unique synthetic identifiers.
3. Process pending items **sequentially**. Each step can resolve metadata, download, stage, create a row and generate the thumbnail. The UI exposes the current filename, phases (`resolving`, `downloading`, `staging`, `saving`), completed count, elapsed time and estimated remaining time.
4. For each item, distinguish `success`, `skipped`, `error` and `notAccessible`. Limited-access out-of-selection results are tracked separately from ordinary processing errors and do not create rows.
5. Delete each staged file immediately after that item's persistence attempt. A requested stop is observed between items, not guaranteed to interrupt the picker or a currently blocked OS operation.
6. When successful items carry GPS matches, group them by detected resort and display `GpsConfirmationDialog`. The user can toggle groups, confirm assignments, or skip the step; grouping does not make GPS matches irrevocable.
7. `buildGpsGroups` also computes unassigned videos on the same date, but does not auto-fill a date that received multiple different resort detections in the batch. Applying a group updates imported rows and eligible same-day unassigned rows.
8. Store the summary in the **volatile** `bulkImportSummaryService` and return to Home. Home consumes it on focus and presents success/skipped/error/out-of-selection counts. Do not show an independent summary from the importer.

## GPS and resort catalog

- `src/constants/skiResorts.json` is a bundled master (name, prefecture and coordinates when present); update it through the dataset script and review changes rather than editing geocoding by intuition.
- `findNearbySkiResorts(lat, lon, thresholdKm = 30, maxResults = 5)` computes Haversine distances using Earth radius 6371 km, excludes entries without coordinates, sorts ascending, and returns up to five candidates within 30 km.
- A **suggestion** is not a proven visit. Resort proximity can be ambiguous. The single importer shows selectable candidates; the batch uses nearest-resort candidates followed by confirmation.
- `SkiResortSearch` also supports saved favorites, search results, recent resorts and same-day suggestions. Manual changes replace the GPS-suggested choice and should not unexpectedly trigger the GPS same-day prompt.
- Newly assigned resort names are strings in `videos.ski_resort_name`, not foreign keys. A curated catalog name is an autocomplete aid; historical values should remain readable if the catalog changes.
- Simulator media inserted with `simctl addmedia` has not reliably preserved embedded movie GPS in this project's verification. GPS behavior requires a real-device check.

## Failure and ownership matrix

| Situation | Current behavior / constraint |
| --- | --- |
| User cancels picker | No row is created; importer returns to idle |
| Photo permission denied | Show permission requirement; no import |
| ID already imported | Open existing detail or cancel; no duplicate |
| Limited access + explicit missing lookup | Skip/abort item as outside selection; do not fabricate a reference |
| Photos lookup fails for other reasons | Keep uncertainty distinct from confirmed out-of-selection; later staging may still fail |
| Unsupported URI / copy failure | Do not attempt to persist an unstageable movie |
| Thumbnail generation fails | Import fails; managed-copy cleanup is attempted immediately, while any partial unreferenced poster may require subsequent orphan cleanup |
| DB insert/tag write fails | Attempt to remove inserted record, thumbnail and managed movie |
| GPS absent or ambiguous | Allow manual resort entry and unassigned state |
| Batch stop | Preserve completed items, stop further iterations, return summary |
| Cloud-only picker content | Current picker may download using `shouldDownloadFromNetwork: true`; no per-attempt preference gate |

## Known architecture debt and planned change

`video-import.tsx` owns substantial orchestration despite the project's preferred thin-route architecture (Issue #80). The target controlled media acquisition under Issue #86 would replace the picker/materialization path, but **no new PhotoKit picker, verified transfer queue, or consumer preference screen is wired** at this baseline. Treat `src/types/media.ts` and `modules/snowlog-media` as forward-compatible groundwork, not a reason to describe the current UI as Wi-Fi-only or copy-by-default.

## Sources

`src/app/video-import.tsx`; `src/services/importService.ts`; `src/services/mediaService.ts`; `src/services/thumbnailService.ts`; `src/utils/{assetId,geoUtils,playbackSource,dateUtils,bulkImportProgressUtils}.ts`; `src/components/{GpsConfirmationDialog,BulkImportProgress,SkiResortSearch}.tsx`; `src/database/repositories/videoRepository.ts`; Issue #80, #86 and #91.
