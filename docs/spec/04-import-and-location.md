# Video Import, Metadata Acquisition and Resort Resolution

## Scope and execution status

This chapter specifies the **currently connected** iOS import screen (`src/app/video-import.tsx`) and `importService.importVideo`. It does not describe the proposed Issue #86 native identifier-only picker as shipped. The shipping flow still uses `expo-image-picker`, can materialize cloud videos before its selection promise resolves, and is not controlled by the new unconnected `mediaPriority` state machine.

## Single import: ordered flow

1. User enters `/video-import` from Home and requests Photos permission using Expo Image Picker. If denied, show the localized authorization warning; do not start import.
2. Query `requestPhotosAccess` to distinguish full, limited and no access.
3. Launch the system library picker with video media, EXIF enabled, no editing, passthrough video export and `shouldDownloadFromNetwork: true`. This is a **network-capable picker** even before the app can inspect the selected results.
4. If a selected item has an `assetId`, query `getVideoByAssetId`. When already imported, present cancel/open-existing-detail rather than creating a duplicate.
5. Clear previous selection and staged assets, with a generation token that prevents an old asynchronous result from replacing a newer picker result.
6. For identified assets, attempt Photos metadata lookup (`lookupAssetWithDownload`): first without network; retry with network if the first lookup throws a recognized Photos error. Extract creation time, local URI and GPS location when available.
7. When Photos authorization is **limited**, an identified video outside the authorized subset returns lookup `notFound`; `isOutsideLimitedSelection` blocks import and offers Settings. A failed lookup is not equivalent to `notFound`; do not label arbitrary errors as out-of-selection.
8. Stage the chosen local source file into app cache (supported `file://` and `content://` inputs). Do not present a ready-to-save state unless a staged file exists. Generate a preview thumbnail from the **actual staged file**.
9. Pre-fill optional user metadata using EXIF or library creation time and provide resort suggestions. User may change title, resort, technique selections, tag IDs and memo before confirming.
10. On Save, assign the existing Photos identifier or a `synthetic:<UUID>` identifier if unavailable; construct `ImportableAsset`, normalize the capture date from EXIF -> Photos creationTime -> current time and call `importService.importVideo`.
11. After successful save, optionally ask whether to assign the selected GPS-derived resort to otherwise-unassigned videos from the same local capture day; clean up staging, signal success and return Home.
12. On failure, leave the editor in place, show an error, and allow retry. A new selection invalidates older asynchronous work.

**Source:** `handlePickVideo`, `handleSave`, `stageAssetFile`, `isOutsideLimitedSelection`, `promptApplySameDayResort` in `src/app/video-import.tsx`.

## Shared persistence service

`importVideo(asset, metadata, {sourceUri})` executes:

- Derive the source URI, classify synthetic identity, allocate video UUID and managed path (if synthetic).
- Protect the expected new JPEG and managed movie paths from concurrent orphan cleanup during import.
- If synthetic, persist an app-owned video copy to `Documents/videos/`; an ordinary Photos asset remains **reference** mode and does not retain the full staged movie.
- Generate and save a JPEG thumbnail, attempting the source URI fallback if the first target cannot be decoded.
- Insert a `videos` row with duration rounded to seconds, Unix-second capture time, title (explicit text or localized date default), resort, memo, JSON technique names, favorite default, availability and storage ownership.
- Insert selected tag associations if any.
- On failure before persistence, remove partial managed file; on failure during persistence/association, best-effort remove the inserted row and generated files.
- Always release the temporary cleanup-protection handle. The caller separately removes its cache staging file.

Note that this older import path is not the new `videoTransferJobRepository.commitImportedVideoWithTags` atomic job commit. The import screen currently invokes `importVideo`.

## Batch import: ordered flow

1. Request Photos permission and record current full/limited access.
2. Set `bulkPhase = preparing` **before** opening the picker, because picker preparation can continue after the picker UI dismisses.
3. Launch `expo-image-picker` with `allowsMultipleSelection: true`, `selectionLimit: 20`, ordered selection, EXIF, passthrough export and network allowed.
4. On cancellation, return to idle; on picker failure, distinguish Photos/iCloud errors from generic picker failures. The preparation phase must **not** show elapsed time because JS cannot observe exactly when the user finished browsing.
5. Once returned, start the import-time clock, compute all non-null `assetId` matches via `getExistingAssetIds`, mark existing matches `skipped`, and allocate synthetic IDs for missing identities.
6. Iterate **serially** through pending items; the progress step moves through resolving, downloading, staging and saving. A requested stop prevents subsequent items; it does not retroactively undo completed rows.
7. For each item: lookup Photos metadata, reject limited-access out-of-selection items as `notAccessible` (separately from `error`), stage the file, resolve creation timestamp, import with empty/default annotations, derive the nearest GPS resort if available, and remove the stage in a `finally` block.
8. After the loop, build resort groups only from successfully imported videos with GPS matches; group by detected resort and display the **minimum** distance observed in that group.
9. When a capture day maps to exactly one detected resort within the batch, offer the same resort to preexisting unassigned videos that day; do not use this propagation for a day with conflicting detected resorts.
10. Present a GPS confirmation screen when any groups exist; selected groups update their imported video rows, then potentially preexisting unassigned rows. Skipping the confirmation leaves the resort assignment unchanged.
11. Store success/skipped/error/not-accessible counts in `bulkImportSummaryService`, close the modal, and show a localized summary from Home on next focus.

The summary cache is **in-memory**, not a durable jobs table. An app termination can lose the pending summary. Batch status values include `pending`, `importing`, `success`, `skipped`, `error` and `notAccessible`.

## GPS and suggestions

`src/constants/skiResorts.json` includes **378** records with names, prefectures and coordinates (verified at baseline). `findNearbySkiResorts` uses Haversine distance (Earth radius 6,371 km), includes candidates at most **30 km** away, sorts ascending distance, and returns at most **5** by default. These are **suggestions**, not an authoritative geofence or proof that the skier was on that resort's trails.

- Single import: nearby list informs the resort chooser; if a GPS suggestion is accepted, a same-day propagation prompt may appear after save.
- Batch import: closest match becomes a tentative group; user confirms groups before resort names are written.
- `SkiResortSearch` supports master-data autocomplete and additional groups of recent/same-day/favorite suggestions; a resort field is not a foreign key and may contain a user-selected name.
- Without GPS, video import still succeeds. An ambiguous or inaccessible Photos location must not block import.

## Capture-date policy and units

- `expo-image-picker` `asset.duration` is converted from milliseconds into seconds on the current path; persisted duration is rounded.
- `assetInfo.creationTime` and EXIF parser results are milliseconds; stored `capturedAt` uses seconds.
- Priority: parsable EXIF `DateTimeOriginal` -> library creation time -> current time when absent. Do not convert an already-second timestamp a second time.
- Post-import startup repair can update erroneous `capturedAt` from Photos; details in [02-system-architecture.md](02-system-architecture.md).
- Users cannot yet manually correct capture date in the details screen; see Issue #93.

## Failure and cancellation contract

| Event | Current result |
| --- | --- |
| Photos permission denied | Dialog; no picker or row |
| Picker canceled | Reset import/batch state without row |
| Already imported Photos asset | Skip/open existing; prevents duplicate |
| Limited-access identifier outside granted Photos subset | Do not create a broken reference; report `notAccessible` |
| Cloud-only media needs download | Current picker/lookup **may use network**; not under future Wi-Fi-only policy |
| Stage/preview fails | Prevent save or report item error; remove partial cache |
| Individual batch item fails | Continue to later items; aggregate error |
| User stops batch | Stop after current safe point; preserve completed imports |
| GPS absent/conflicted | No auto-commit of uncertain resort assignment |
| DB insert/link fails | Best-effort rollback/cleanup; do not report success |
| Screen changes during metadata fetch | Generation/cancel guard prevents stale selection overwrite |

## Architectural limitation and planned replacement

`src/app/video-import.tsx` is over 1,400 lines and still owns Photos acquisition, staging, progress and GPS orchestration. New controlled acquisition primitives and durable jobs live elsewhere but are not connected to this screen. **Do not write prospective Issue #86 behavior into this chapter as an accomplished feature.** See [08-media-infrastructure.md](08-media-infrastructure.md) for the currently implemented pieces and the outstanding adapter/UX work.

**Evidence:** `src/app/video-import.tsx`, `src/services/importService.ts`, `src/services/mediaService.ts`, `src/services/thumbnailService.ts`, `src/services/managedVideoFileService.ts`, `src/utils/geoUtils.ts`, `src/utils/playbackSource.ts`, `src/types/index.ts`, `scripts/tests/assetLookup.test.cjs`, `scripts/tests/bulkImportProgressUtils.test.cjs`.
