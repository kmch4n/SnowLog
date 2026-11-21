# Quality Gates, Verification and Release Engineering

## Baseline and verification principle

Automated tests are valuable **but not a substitute for iOS integration checks**, especially for media, PhotoKit, Photos authorization, iCloud acquisition, filesystem ownership and hardware network-state transitions. Some repository Node tests compile isolated TypeScript modules and some match source structure using regular expressions; a passing assertion that never fails under a deliberate negative control does not establish behavior.

A documentation-only PR should run link/contract checks and check code/document drift; it does not require a new App Store binary. An implementation PR affecting native behavior additionally requires iOS evidence appropriate to its risk.

## Root scripts

| Command | Purpose / environment |
| --- | --- |
| `npm ci` | Deterministic install from `package-lock.json`; invokes postinstall patch |
| `npm run start` | Start Expo Metro |
| `npm run ios` | Launch native iOS development runtime |
| `npm run android` | Development launcher exists; Android product unsupported |
| `npm run web` | Expo browser preview |
| `npm run lint` | Expo ESLint checks |
| `npx tsc --noEmit` | Full TypeScript type check |
| `npm test` | Node `--test` over `scripts/tests/*.test.cjs` |
| `npm run test:web` | Expo Web export into `dist` plus headless Chrome smoke |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:studio` | Drizzle inspection tool |

`postinstall` and `eas-build-post-install` execute `scripts/patchImageUtilsCache.js`, which modifies installed Expo image-utils cache behavior. Treat this as build infrastructure and evaluate compatibility when upgrading Expo. The project runs Node **22** in CI.

## Standard CI on push and PR

`.github/workflows/ci.yml` triggers on pushes to `main` and pull requests. It has two jobs:

1. **Lint, types, tests:** checkout, Node 22 npm cache, `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`.
2. **Web smoke:** checkout, Node 22, `npm ci` and `npm run test:web`.

No production EAS build is triggered on every PR. A successful CI run does not validate that an App Store build can contact Photos, render iOS native UI, or move a file between iCloud and local storage.

## Focused automated test families

| Change area | Existing checks / examples |
| --- | --- |
| DB schema, foreign keys, transaction semantics | `migrationForeignKeys.test.cjs`, `syncTransactions.test.cjs`, `repositoryHarnessDriver.test.cjs`, `repositoryHarnessMigrations.test.cjs`, `tagRepository.test.cjs` |
| Storage backfill and path ownership | `videoStorageMode.test.cjs`, `managedVideoPath.test.cjs`, `videoStorageBackfill.test.cjs`, `videoStorageMigration.test.cjs`, `videoDeletionOrder.test.cjs` |
| Media transfer design-in-progress | `videoTransferJob.test.cjs`, `videoTransferJobRepository.test.cjs`, `videoTransferRunner.test.cjs`, `videoTransferRecovery.test.cjs`, `mediaPolicy.test.cjs`, `mediaPolicyService.test.cjs` |
| Media/source and error handling | `assetId.test.cjs`, `assetLookup.test.cjs`, `photosErrors.test.cjs`, `playbackSource.test.cjs`, `mediaMutationCoordinator.test.cjs` |
| Thumbnail/cleanup | `thumbnailPath.test.cjs`, `orphanCleanupRun.test.cjs`, `videoDeletionOrder.test.cjs` |
| Import, list and filtering | `bulkImportProgressUtils.test.cjs`, `homeSwipeDelete.test.cjs`, `videoListEquality.test.cjs`, `videoSearch.test.cjs` |
| Calendar, seasons, statistics, location | `calendarUtils.test.cjs`, `dateUtils.test.cjs`, `dashboardStats.test.cjs`, `geoUtils.test.cjs` |
| i18n, preferences, UX | `i18nKeys.test.cjs`, `i18nPlural.test.cjs`, `appPreferenceRepository.test.cjs`, `techniqueSeeding.test.cjs`, `webAlertQueue.test.cjs` |
| Web platform shape | `webShimParity.test.cjs`, `webEmptyModules.test.cjs`, `test:web` |
| JS/Swift contract | `snowlogMediaContract.test.cjs` |
| Native Swift foundation | `modules/snowlog-media/ios/Core/Tests/SnowLogMediaCoreTests.swift` (26 XCTest methods at baseline) |

Some repository-harness tests use a compiler, a temporary directory and the **actual** production Drizzle Expo SQLite driver; they validate specific transaction behaviors more convincingly than isolated mocks. Read `.memory/testing.md` before adding or reorganizing these tests because import structure affects where compiled JS is emitted.

**Negative-control expectation:** for a new behavior test, deliberately break the target rule in an isolated branch/instrumented test and verify the assertion detects it. Remove the mutation before committing.

## iOS simulator and native-core testing

`.github/workflows/ios-simulator.yml` is manually dispatchable. It runs on `macos-26`, selects the expected Xcode version, `npm ci`, performs a clean iOS prebuild, builds a simulator app, boots a Japanese-language iPhone simulator, adds small movie fixtures, and executes Maestro UI flows from `.maestro/`. It captures hierarchy, logs and screenshots as workflow artifacts even on failure. Screenshots must be **inspected**; “workflow completed” alone does not show that a view was correct.

Current fixture videos are used for smoke/integration. Simulator insertion via `simctl addmedia` does **not** reliably preserve their encoded GPS location metadata as a Photos asset location; GPS feature verification needs an appropriate fixture/import strategy and device-level evidence. See `.memory/testing.md` and `docs/verification/`.

`.eas/build/ios-test.yml` and `eas.json` profile `ios-test` declare the SnowLogMediaCore XCTest test spec, build a no-signing simulator target, execute XCTest and upload an `.xcresult` bundle. This checks pure Swift infrastructure, **not** the not-yet-complete PhotoKit adapter or real-world cellular behavior. The native Core test suite currently contains 26 methods, including exactly-once cancellation, path eligibility, timeout, chunk copying, filename choice and prepared-file checks.

## Manual verification matrix

| Source change | Minimum additional evidence |
| --- | --- |
| Imports / iCloud | Real iOS picker, local Photos video, cloud-only video, canceled picker, duplicate import, limited authorization, failure + retry |
| Copy/storage ownership | Fresh install and **upgraded** database, synthetic copied video playback, moved container paths, low free space, interrupted import, restart |
| Playback | Reference/copy, absent source, restricted Photos access, authorization recovery, device-local and iCloud-only files |
| Deletion/cleanup | DB fail-before-delete, file fail-after-delete, cleanup grace period, duplicate group removal, protected in-flight file |
| Calendar/date | Local-midnight boundaries, time zones, October season rollover, diary-only day |
| Native policy | Wi-Fi, cellular-only, expensive/constrained Wi-Fi, no path, connection loss mid-request, no unintended network acquisition |
| Web shim | Web build, browser route navigation, action dialogs, no missing exports |
| UI/accessibility | Real/simulator visual states, VoiceOver labels, Reduce Motion, keyboard and gesture behavior |
| Migrations | Upgrade from prior schema plus clean install; verify generated SQL and rollback/failure path |

Document which of these were run, device/OS/build versions, observations, logs and **unverified** cases. Do not write “verified on iOS” based on JS unit tests.

## EAS / App Store

`eas.json` defines `development`, `preview`, `simulator`, `ios-test` and `production` build profiles; the production profile targets store distribution and auto-increments the remote build version. App Store Connect application ID is configured for production submit.

`scripts/release-testflight.sh` provides a controlled TestFlight release path with npm dependency install, lint, unit tests and EAS production build/auto-submit. Releasing to TestFlight/App Store or deploying the marketing site is a **separate authorized action**, not implicit in a documentation or feature PR. Release notes and App Store screenshots live in `appstore/`; keep marketing claims synchronized with actual deployed behavior.

## Docs-only PR verification

A docs-only PR SHOULD check all of the following:
- all `docs/spec/` files contain English-only prose and valid relative cross-links;
- referenced source paths and key symbols exist on the PR's head commit;
- README, AGENTS and any agent-specific index point to the correct canonical spec;
- old Japanese documentation was not deleted or silently overwritten;
- design-in-progress work is explicitly marked as incomplete;
- diff is limited to intended docs and contributor instructions;
- CI status is observed and any checks **not run** are stated rather than invented.

**Evidence:** `package.json`, `.github/workflows/ci.yml`, `.github/workflows/ios-simulator.yml`, `.eas/build/ios-test.yml`, `eas.json`, `scripts/tests/`, `scripts/webSmoke.cjs`, `scripts/release-testflight.sh`, `.memory/testing.md`.
