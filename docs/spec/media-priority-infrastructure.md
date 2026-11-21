# Media Priority and Durable Acquisition: Implemented Groundwork vs. Missing Integration

> **Status: PARTIALLY IMPLEMENTED, NOT A SHIPPING END-TO-END FEATURE.**
>
> This chapter documents both the executable primitives at the reviewed baseline and the intended contract recorded in Issue #86. Their presence must not be mistaken for a connected preference screen, custom picker, downloader, or offline transfer queue.

## Motivation and desired user contract

Issue #86 defines an explicit choice between conserving **device storage** and conserving **mobile data**:

| Proposed priority | Persisted value | Intended storage of new Photos-backed movies | Intended acquisition behavior |
| --- | --- | --- | --- |
| Save device storage | `save_space` | `reference` | Local reads when possible; require per-play confirmation before a network acquisition |
| Save mobile data | `save_data` | `copy` | Create a verified app-managed movie, scheduling network acquisition only on eligible Wi-Fi (best effort) |

A third unselected state (null) is essential: no default should implicitly authorize a network acquisition. Choosing a new preference would affect future imports and future acquisition gates, not rewrite existing video rows. Reference-to-copy conversion is a proposed explicit user operation. iOS PhotoKit does not offer a guaranteed per-request cellular transport switch; a Wi-Fi path observer is a scheduling/cancellation gate, **not** a zero-cellular-bytes promise.

**Important:** These are accepted **product requirements**, not the currently wired user experience. The shipping importer still uses `expo-image-picker` with network download permitted and delegates persistence to `importService.importVideo`.

## Completed storage substrate (shipping in app v1.4.0)

- `videos.storage_mode` / `managed_video_path` columns and case-insensitive ownership uniqueness are in schema and migrations.
- `storageMigrationService.migrateVideoStorage` gates startup, backfilling old synthetic rows as `copy` and Photos-backed rows as `reference` before dependent tasks.
- `usePlaybackSource` resolves the source by `storageMode`; deletion/cleanup uses managed path ownership rather than merely the synthetic-ID prefix.
- Existing synthetic imports remain managed copies for backward compatibility. The app has **not** made all Photos-backed imports configurable.
- Historical JSON export/restore is removed; any Issue #86 clauses requiring a new JSON backup version were superseded by Issue #90.

## Present, but not integrated into the live import/player

| Component | Location | Verified role |
| --- | --- | --- |
| `MediaPriority` union and native boundary types | `src/types/media.ts` | Compilable TypeScript contract; no shipping policy-selector screen |
| Preference service | `src/services/mediaPolicyService.ts` | Reads/writes `media_priority` without a default; no current UI caller |
| Acquisition decision | `src/utils/mediaPolicy.ts` | Pure policy returning `local`, `network`, `waitWifi`, `needsConsent`, or `denied` |
| Transfer-state machine | `src/services/videoTransferJob.ts` | Pure events, states, payload validation, serialization |
| Persistent job table and repository | `src/database/schema.ts` and `videoTransferJobRepository.ts` | Transactional atomic commits and incomplete-job rows |
| Transfer runner | `src/services/videoTransferRunner.ts` | Pure IO-injected protocol from staging to commit, not connected to picker |
| Recovery planner | `src/services/videoTransferRecovery.ts` | Determines reconcile/pause/fail/drop actions, not installed in startup flow |
| Mutation coordinator | `src/services/mediaMutationCoordinator.ts` | Serial queue class/singleton, not yet universally applied to current import/delete |
| Swift media core | `modules/snowlog-media/ios/Core/Sources/` | Native logic/tests for requests, network path, copying and validation |
| Expo module facade | `modules/snowlog-media/ios/Module/SnowLogMediaModule.swift` | Currently exports **only** `contractVersion`; no usable PhotoKit API |

No `photoMediaService.ts` adapter, identifier-only PHPicker, fully implemented PhotoKit acquisition methods or transfer queue UI is present. Retained job states therefore should not be counted in the app's active video inventory.

## Network-policy decision function

`decideAcquisition(request)` is pure and first checks whether data is already local:

1. If `needsNetwork = false`, return `local` regardless of priority.
2. Without an active explicit user intent, return `denied/noIntent`. Screen mount, scrolling or app startup is not permission.
3. With no valid stored priority, return `denied/noPriority`.
4. For `save_data`, allow `network` only on **eligible Wi-Fi**; otherwise return `waitWifi`.
5. For `save_space`, return `needsConsent` unless the user confirmed this specific attempt; then allow `network`.

`toNetworkAccess` maps **only** the `network` decision to `allow`; all other cases produce explicit `deny`. `shouldCancelOnPathLoss` cancels in-progress **network** acquisition in `save_data` if eligibility is lost, but not a local-only transfer or one-time consented `save_space` acquisition.

An eligible path (`isEligibleWifiPath`) must have an observed satisfied path, use Wi-Fi, not be expensive, not be constrained, and not simultaneously use cellular. Unknown path state is **ineligible**.

## Transfer job states and events

`VideoTransferJobState` values:

| State | Meaning | Selected events |
| --- | --- | --- |
| `pending` | Eligible intent waiting to start | `start → running`, `background → paused` |
| `running` | Active operation | `needsWifi → waiting_wifi`, `background → paused`, `fail → failed`, `complete → remove job` |
| `waiting_wifi` | Intent retained, no eligible network | `wifiEligible` or `retry → pending`; `background → paused` |
| `paused` | Stopped after interruption/background | `retry → pending` |
| `failed` | Blocked with a typed error | `retry → pending` |

`cancel` removes a job in any retained state. Invalid state/event pairs produce `ignored` instead of throwing: late native callbacks are expected and should not mask genuine errors. Removal on `complete` is different from removal on `cancel`. Completion is only valid after the actual video commit; a waiting job is not a library video.

`VideoTransferPayload` has version `1`, immutable asset snapshot, optional import metadata, `storageIntent: "copy"`, destination relative path, and optional verified `VideoTransferOutput` descriptor. Network consent is **not serialized**; making it durable would wrongly authorize a future session. `parseVideoTransferPayload` validates the serialized shape and returns null for malformed/unsupported data.

## Transfer ordering and disk safety

`runVideoTransfer` depends on an explicitly injected adapter/sink and follows:

1. Check cancellation; `prepare(assetId, requestId, networkAccess)` using an **explicit** `allow`/`deny` flag.
2. If ready, check available disk space. The JS runner reserves **256 MiB**; unknown free-space measurement does not itself reject an otherwise viable operation. The native core also has a reserve rule for known source length.
3. Derive verified facts (bytes, extension, duration, dimensions).
4. Persist the output descriptor **before** promoting the staged file.
5. Recheck cancellation; move/rename the file into its final app-owned relative destination.
6. Atomically commit the row and tags or existing-row conversion with job removal.
7. On failed/declined DB commit, discard unowned final output; always release the prepared resource.

The order prevents creating a durable row that points at a never-promoted file. If the app dies after promotion but before DB commit, the job's descriptor supports crash recovery.

Outcome mapping distinguishes `committed`, `skipped` and `blocked`; only `needs_network` becomes a Wi-Fi wait, a cancelled attempt revokes intent, and other typed block codes become `failed`.

## Crash-recovery planner (not connected to boot)

`planTransferRecovery` inspects whether a row already exists, payload validity, whether a final file exists and matches a saved descriptor, and the prior job state. It selects `dropJob`, `finalize`, `pause`, `fail` or `keep`, plus a flag to discard unsafe uncommitted files. It **must execute before orphan cleanup** when eventually integrated: cleanup cannot distinguish a promoted-but-not-committed output without reconciled job knowledge.

The current root layout does **not** call this planner. Do not claim that a crashed transfer automatically resumes or finalizes in v1.4.0.

## Swift core and its current boundary

`SnowLogMediaCore` includes:

- `MediaRequestToken` and `MediaRequestRegistry`: one terminal outcome per request, cancellation handlers, late-callback suppression and unique active request IDs.
- `NetworkPathGate` / `NetworkPathState`: observes `NWPathMonitor` and maps path eligibility; uses a best-effort Wi-Fi check, not a transport prohibition.
- `NoProgressWatchdog`: timeout after **60 seconds** without **increasing** progress; repeated identical fractions do not count.
- `ChunkedFileCopier`: bounded **1 MiB** default chunks, cancellation checks before each chunk, partial-file cleanup on failure.
- `PreparedFileVerification`: reject zero bytes, unsupported container or track, invalid duration, or changed source; supported new extensions MOV, MP4, M4V.
- `FreeSpaceReserve`: keep back 256 MiB and include known source length in native preparation capacity checks.
- `MediaFailureCode`: shared Swift/TypeScript error code names tested for parity.

The Expo-module entrypoint links the core and returns a constant but **does not expose** `readPhotoVideo`, `preparePhotoVideo`, cancellation or the designed identifier-only PHPicker. This is not a functioning native adapter.

## Remaining implementation gates

Issue #86 status as reviewed 2026-11-21: native-build groundwork and storage migration delivered; Swift core partly delivered; PhotoKit selection/adapter, connected consumer policy, queue UI, source-safe playback changes and comprehensive device verification remain. An end-to-end release requires at minimum:

- A real, JS-callable native adapter and complete PhotoKit resource contract.
- Explicit storage-priority choice with no preset; a durable setting with a clear error path.
- Wiring importer, reference playback and copy playback to the selected policy, including consent and Wi-Fi waiting/interruptions.
- Jobs created/consumed in live flows, crash recovery before cleanup and no ghost library rows.
- Single and bulk import parity for limited Photos authorization, duplicate detection, no-network paths, cancellation and app lifecycle.
- Real iPhone tests for iCloud-only assets, Wi-Fi/cellular transitions, Photos-permission changes, backup restores, disk exhaustion and file error injection.
- Regression tests for existing synthetic managed copies and v1.3 → v1.4 migration.

**Source of requirement truth:** Issue #86's current status and accepted decisions. **Source of implementation truth:** the executable wiring named above. Update this chapter as each gate moves from unimplemented to actively invoked.

## Sources

`src/types/media.ts`; `src/services/{mediaPolicyService,videoTransferJob,videoTransferRunner,videoTransferRecovery,mediaMutationCoordinator,storageMigrationService}.ts`; `src/utils/mediaPolicy.ts`; `src/database/repositories/videoTransferJobRepository.ts`; `modules/snowlog-media/ios/`; `src/app/video-import.tsx`; `src/app/_layout.tsx`; Issue #86.
