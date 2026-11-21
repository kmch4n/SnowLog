# Media Storage Infrastructure, Native Foundation and Transfer Jobs

## Status: do not confuse implemented foundations with a shipped feature

Issue [#86](https://github.com/kmch4n/SnowLog/issues/86) contains a confirmed long-term product contract: let users prioritize **device storage** or **mobile data**. At the 2026-11-21 baseline, the issue itself reports:

| Workstream | Status | What can actually be asserted |
| --- | --- | --- |
| A — native feasibility | Partial | EAS simulator Core XCTest instrument established; other instrumentation and real-device network checks pending |
| B — storage model | **Integrated in 1.4.0** | `storage_mode` / `managed_video_path`, startup backfill, storage-mode source resolution, deletion ordering |
| C — native media adapter | **Infrastructure only** | Linked Expo module, pure Swift path gate, tokens, copier, watchdog, verification rules; no PhotoKit acquisition API exposed to JS |
| D — durable transfer foundation | **Library/repository infrastructure present** | Transfer table, repository, state machine, runner, recovery planner and mutation coordinator; current import UI still uses legacy `importVideo` |
| E/F/G — final integration and release | Not delivered | Identifier-only picker, controlled acquisition, playback flow, Settings/UX, full validation |

This status is central to the accuracy of all other chapters. A source file implementing a pure function is not evidence that current users can trigger it.

## Separating media identity, storage and network consent

Three **independent** dimensions must never collapse into one Boolean:

1. **Identity:** `assetId` is a Photos identifier or the string prefix `synthetic:` plus generated ID. It answers which original asset was selected, if any.
2. **Storage mode:** `videos.storage_mode` is `reference` or `copy`. It answers which bytes SnowLog owns. `managed_video_path` names its app-owned copy, if any.
3. **Acquisition permission:** a **per-attempt** `MediaNetworkAccess = deny | allow`, derived from current user intent and network state. It is neither an asset identity nor a persistent global consent.

The current shipping importer still makes storage mode match synthetic status (synthetic -> copy; Photos ID -> reference). That is an implementation state, **not** a permanent schema constraint: future Photos-backed copied videos must remain expressible.

## Persistent storage compatibility migration (integrated)

`planStorageBackfill` converts old `videos` rows as follows:

- ordinary asset ID -> `reference` with null managed path, leaving prior availability unchanged;
- synthetic asset ID -> `copy` and `videos/<id>.<inferred extension>`;
- unsafe ID or lowercased path collision -> leave a pathless, unavailable `copy` row rather than fabricate ownership or delete a file.

`migrateVideoStorage` is gated by `video_storage_migration_version = "1"`. It applies the updates and version marker in one **synchronous** Drizzle transaction. This must complete immediately after SQL migrations, before thumbnail repair, cleanup or route access. Reapplying to a dataset after a user has chosen a new mode would corrupt intent; hence the marker.

A case-insensitive unique SQLite index on managed paths prevents two rows from owning one file. Relative paths avoid invalid absolute container prefixes after iOS restore.

## User-priority policy: implemented pure decision code, not integrated UI

`src/services/mediaPolicyService.ts` can read/write `media_priority = save_space | save_data`; missing or invalid preference is **null**, never silently normalized. `src/utils/mediaPolicy.ts` exposes `decideAcquisition` and network-path predicates. The **target contract** embodied by these pieces is:

| Request context | Decision |
| --- | --- |
| All needed bytes are local | `local`, independent of preference |
| Needs network but no active explicit user intent | `denied(noIntent)` |
| Needs network and preference missing/invalid | `denied(noPriority)` |
| `save_data` and network is eligible Wi-Fi | `network` |
| `save_data` but path unknown, unsatisfied, cellular, metered or constrained | `waitWifi` |
| `save_space`, network needed, per-attempt confirmation given | `network` |
| `save_space`, network needed, no confirmation | `needsConsent` |

`toNetworkAccess` maps **only** `network` to `allow`, every other case to `deny`. `shouldCancelOnPathLoss` cancels a running network transfer when `save_data` loses eligible Wi-Fi; local operations and confirmed `save_space` do not inherit that stop rule.

This is **best-effort scheduling**, not a transport-level cellular prohibition. PhotoKit's process can select its own connection even if a path was eligible at request start. UI copy must never promise zero cellular bytes in a transition. Current iOS picker/playback flows **do not yet consult this policy**.

## Transfer job state machine (implemented pure logic)

`videoTransferJobs` stores unfinished `import` / `convert` intent. The pure state machine `applyVideoTransferEvent(state, event)` has five retained states: `pending`, `running`, `waiting_wifi`, `paused`, `failed`.

| Current state | Event | Next state/effect |
| --- | --- | --- |
| pending | start | running |
| pending | background | paused |
| running | needsWifi | waiting_wifi |
| running | background | paused |
| running | fail(code) | failed, retaining typed code |
| running | complete | remove job as completed |
| waiting_wifi | wifiEligible / retry | pending (never auto-start by state machine) |
| waiting_wifi | background | paused |
| paused / failed | retry | pending, clearing previous error |
| any retained state | cancel | remove job as canceled |
| any state | unspecified event | ignored; never throw for late callbacks |

A queued intention does **not** count as a library video. Completed rows must not stay in the job table. Job `payload_json` is versioned `1` and carries acquisition metadata snapshot, storage intent `copy`, final relative path and optionally validated output facts. It deliberately contains **no persisted network grant or external URL**. The parser treats malformed/unknown versions as invalid, rather than assuming backward compatibility.

## Transfer commit ordering (implemented and unit-tested)

`runVideoTransfer` is a dependency-injected, non-native orchestration function; it is not yet the live import screen:

1. Reject an already-canceled operation.
2. Prepare the selected Photos asset with **explicit** `networkAccess` and a unique request ID; return typed blocked results for failed acquisition.
3. Check cancellation and free space. JS reserves at least **256 MiB**; if free space is unknown, it does not fail solely for that reason.
4. Persist validated output descriptor to job payload **before** moving the file.
5. Recheck cancellation and atomically promote staged bytes into the final relative destination.
6. Commit row/tag associations/job removal in one DB transaction, or convert existing reference row without recreating the identity.
7. On failed/refused DB commit, discard only the file promoted by this operation; release prepared media in `finally`. Never report a ready video before commit.

Why this order: a successful DB row pointing at absent bytes is harder to recover than an orphan file, which can be discarded. A crash after verified file rename but before DB commit can be recognized by the saved output descriptor.

`runVideoTransfer` reports `committed`, `skipped`, or typed `blocked`; `outcomeToJobEvent` distinguishes Wi-Fi waiting from genuine failure, and canceled/skipped/completed paths.

## Crash recovery (planner implemented; boot integration pending)

`planTransferRecovery` examines whether a job's video row exists, payload parses, verified output descriptor exists, final file exists and matches, and its prior state:

- Video row already exists -> drop stale job, **never delete owned file**.
- Malformed payload -> fail the intent and clean untrusted output if present.
- Verified matching final file -> finalize the row without redownloading.
- Verified descriptor disagrees with file -> fail `source_changed` and discard unsafe output.
- Missing/unverified final output + previously `running` -> pause, **do not auto-acquire** on restart.
- Other retained states -> keep, removing invalid transient output if needed.

A fully connected future startup **MUST** recover transfer jobs before orphan-file cleanup; the current startup code does not yet call this planner. Do not state that crash recovery is already automatic for current user imports.

## Native Swift foundation (compiled but not full PhotoKit API)

The local Expo module in `modules/snowlog-media/ios/Module/SnowLogMediaModule.swift` currently exports **only** `contractVersion = 1`. Its core pod, `SnowLogMediaCore`, contains no JavaScript-callable picker/metadata/prepare/poster methods yet.

| Swift component | Verified responsibility |
| --- | --- |
| `MediaRequestToken` / `MediaRequestRegistry` | Cancel handles; exactly-once completion; reject live duplicate request IDs; late callbacks ignored |
| `NetworkPathState` | Snapshot of eligibility fields; fail closed for unknown path |
| `NetworkPathGate` | `NWPathMonitor` wrapper; observers and a last-known path, not a cellular transport firewall |
| `NoProgressWatchdog` | 60 seconds without **increasing** download, byte or export progress -> timeout |
| `ChunkedFileCopier` | Bounded 1 MiB chunks, cancel between chunks, sync and close, remove partial output on failure, never overwrite destination |
| `FreeSpaceReserve` | Source size plus 256 MiB reserve when known; cannot assume free space from unknown measurement |
| `VideoFilename` | Choose current full-size resource filename, then original video, then stable asset-ID-derived fallback |
| `PreparedFileVerification` | Nonzero bytes, readable video track, valid finite positive duration, supported container extension/type, unchanged source |

JavaScript and Swift share a fixed set of typed failure codes such as `needs_network`, `not_accessible`, `missing`, `cancelled`, `source_changed`, `insufficient_space`, `timeout` and `io_error`. `scripts/tests/snowlogMediaContract.test.cjs` guards enum/field/extension/reserve parity.

The XCTest target at `modules/snowlog-media/ios/Core/Tests/SnowLogMediaCoreTests.swift` contains **26** test methods at the baseline. The EAS `ios-test` profile can execute them in a simulator (this is not proof of real-device network or PhotoKit behavior).

## Future integration constraints (planned in #86)

The accepted issue calls for an identifier-only PHPicker (not implicit media materialization), PhotoKit metadata/prepare APIs with typed outcomes, thumbnails that do not silently download full movies, an explicit priority choice, a foreground transfer queue, per-play confirmation, controlled conversion of existing references to copies, and device/connection testing. These are **requirements under development**, not guaranteed available features.

**Evidence:** `src/types/media.ts`, `src/utils/mediaPolicy.ts`, `src/services/mediaPolicyService.ts`, `src/services/videoTransferJob.ts`, `src/services/videoTransferRunner.ts`, `src/services/videoTransferRecovery.ts`, `src/database/repositories/videoTransferJobRepository.ts`, `modules/snowlog-media/`, `src/app/video-import.tsx`, `src/hooks/usePlaybackSource.ts`. See Issue #86 for the complete accepted future contract.
