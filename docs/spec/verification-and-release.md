# Verification, CI, Native Device Checks, and Release Discipline

## Evidence levels

Separate five forms of validation rather than treating one as proof of all the others:

| Level | What it establishes | What it does not establish |
| --- | --- | --- |
| Static review and spec traceability | Requirements and code paths can be inspected for consistency | Correct execution or device compatibility |
| ESLint and TypeScript | Lint conventions and declared static types | Runtime Web shim resolution, PhotoKit, database corruption |
| Node unit/regression tests | Selected pure rules and repository behavior under test harnesses | Real iPhone permission/iCloud/codec behavior |
| Web smoke | Exported browser bundle renders important routes without crashing | iOS native lifecycle and Photos interactions |
| iOS simulator / physical device | App boots and UI paths work under that environment | Cloud Photos, network transport, permissions and restore on **every** physical device |

The documentation is an architectural evidence base, **not** a substitute for running affected tests or reproducing important failures.

## Root automated commands

Run from the repository root:

| Command | Purpose and notes |
| --- | --- |
| `npm ci` | Locked dependency install, including `postinstall` image-cache patch |
| `npm run lint` | Expo ESLint conventions |
| `npx tsc --noEmit` | Strict TypeScript type-check |
| `npm test` | Node test runner over `scripts/tests/*.test.cjs` |
| `npm run test:web` | Expo Web export into `dist/`, then headless Chrome rendered-route smoke |
| `npm run db:generate` | Generate Drizzle SQL/migration metadata **after** editing the schema |
| `npm run db:studio` | Local Drizzle DB inspection |

`scripts/tests/` includes date/calendar/season arithmetic, duplicate detection, source-path validation, media transfer state and recovery, SQLite migration foreign keys/transactions, Web shim/export parity, localization keys and more. Many tests compile selected TypeScript files with the raw TypeScript compiler or use source-string assertions. Read `.memory/testing.md` before adding coverage: small modules may intentionally have no imports or use only relative imports because the test harness assumes a particular emitted path. A text-matching assertion can pass while behavior is wrong; verify a new regression test **fails with the bug restored** whenever practicable.

## CI workflow

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests. Its Node 22 jobs are:

- **Lint/types/tests:** checkout, `npm ci`, `npm run lint`, `npx tsc --noEmit` and `npm test`.
- **Web smoke:** checkout, `npm ci`, and `npm run test:web`.

These gates are necessary but insufficient for native media, SQLite live-driver semantics and iOS rendering. If CI is red, do not report the PR as validated. For a documentation-only PR, automated checks are still useful to detect incidental file changes but are not proof of specification accuracy.

## iOS simulator workflow

`.github/workflows/ios-simulator.yml` is manually dispatched (`workflow_dispatch`) and uses a macOS runner. It creates a clean iOS project with `expo prebuild --platform ios --clean`, builds with Xcode, installs a simulator app, seeds sample movies and drives Maestro scripts under `.maestro/`.

| Flow | Current scope |
| --- | --- |
| `.maestro/01_tabs.yaml` | Launch fresh install; open and screenshot Home, Dashboard, Calendar, Search and Settings |
| `.maestro/02_import.yaml` | Single video through system Photos picker; asserts the GPS resort suggestion; Save, Home, Dashboard and Calendar. The first-frame preview sits inside the pick button's accessibility element, so it is checked on `12_selected.png` rather than asserted |
| `.maestro/03_detail_and_search.yaml` | Detail title and memo typed, screen left at once, reopened: both saved. Search `a_x` (no result), `a_r` and `100%` (result) |
| `.maestro/04_resort_input.yaml` | Detail resort field: an exact master name is saved on blur; clearing the text removes the resort |
| `.maestro/05_techniques.yaml` | Delete a default technique, add one (appended last), restart the app: the deletion persists |
| Uploaded artifact | Screenshots, Maestro debug/hierarchy, app log, and observed Photos test-asset metadata |

Always **inspect the uploaded screenshots**, not just the green status: visual regressions can coexist with a passing tap script. Flows 03–05 reuse the video imported by 02 and run in file-name order. The sample movies are rebuilt by `scripts/make_maestro_media.sh`, which writes the capture date and location as iPhone-style `moov/meta` keys (`scripts/write_quicktime_metadata.py`); Photos ignores the keys that ffmpeg's `use_metadata_tags` writes into `moov/udta/meta` (Issue #98). Simulator success does not verify iCloud downloads, limited-selection permission changes, actual mobile data or backup restore. These require a physical device.

## Native Swift media core tests

The `ios-test` EAS profile in `eas.json` points at `.eas/build/ios-test.yml`. It declares the `SnowLogMediaCore` test spec in the generated Podfile and executes Xcode XCTest without production signing credentials, attaching an `.xcresult` bundle. Issue #86 reports **26 XCTest cases passing on an EAS build as of 2026-11-16** for current core rules; this is historical execution evidence, not a fresh run in this documentation PR and not proof of the absent PhotoKit/JS integration.

The native module's TypeScript/Swift contract parity has additional Node tests; keep error codes, paths, request states and network-path fields synchronized. Add a native adapter only with matching behavior-oriented simulator/device tests.

## Device-based acceptance matrix

At least the following should be repeated before claiming a new release after affected changes:

| Scenario | Verify |
| --- | --- |
| Fresh install | Splash → schema/storage initialization → all five tabs render |
| Upgrade from an older release | Existing video, tags, diary, favorites and settings counts match; no owned copy deleted |
| One local Photos import | Picker, creation date, JPEG preview, editable fields, Save, playback |
| iCloud-only video | Behavior under download failure/latency, no hidden assumptions of local bytes |
| Limited Photos selection | Authorized movie works; unauthorized chosen movie does not create a permanently unplayable reference |
| Synthetic-ID import | App-managed file persists and remains playable independent of Photos |
| Detail editing | Autosave flush on navigation; playback doesn't restart on save |
| Delete/cleanup | Correct DB-first order; no deleted Photos original; orphan cleanup respects fresh/importing files |
| Calendar, search and dashboard | Consistent local-day results and Oct–Sep season including June–September |
| Device storage/restore | Thumbnail/managed-path rebase; explain unresolved Photos ID migration |
| Network policy (when wired) | Local-only, consent, Wi-Fi transitions and cancellation on **real** iPhone |
| Accessibility/localization | Japanese/English strings, permission prompts, VoiceOver labels and reduced-motion presentation |

`docs/verification/1.4.0-testflight.md` and `docs/verification/post-1.4.0-testflight.md` are retained **historical checklists**. Their references to a specific build or TestFlight state must not be assumed to describe the newest `main` commit. Create a current release checklist as appropriate.

## Release procedure and guardrails

`eas.json` defines development, preview, simulator, `ios-test` and production profiles; production uses store distribution and remote build-number auto-increment. The root `scripts/release-testflight.sh` checks `main` is clean and in sync, installs dependencies, runs lint/type/unit gates, signs into EAS interactively and requests a **production build and TestFlight submission** after a confirmation. It **does not** submit an App Store production release/review automatically; App Store Connect steps remain manual.

`.codex/release-prompt.md` records the more detailed release protocol, while `docs/verification/` tracks past device checklists. Releasing without current native verification can put user-owned local media at risk, especially after database/storage changes.

**Do not run `scripts/release-testflight.sh` or deploy the marketing website merely to validate a documentation PR.** A PR merge and a production deployment are separate decisions and require appropriate release approval.

## Documentation-first review checklist

Before implementation, write or update the relevant `docs/spec/` contracts. Before proposing a PR as mergeable:

1. Verify every changed feature against both normative spec and actual call sites.
2. Record success, failure, cancellation, permissions, migration and rollback semantics, not just the happy path.
3. Check old data and newly installed data; confirm transaction and filesystem ownership boundaries.
4. Update tests; show which commands executed, which were unavailable, and outcomes. Never invent a test pass.
5. Confirm Web shim and i18n parity for platform-visible changes.
6. Check URLs and relative links; ensure diagrams/examples reflect present code rather than a planned Issue design.
7. Inspect the full diff, branch ancestry, identity, and commit messages. Avoid unrelated formatting churn or a long chain of granular commits.
8. Verify the PR's scope accurately calls out **unwired work** and **remaining device risk**.

## Sources

`.github/workflows/ci.yml`; `.github/workflows/ios-simulator.yml`; `.maestro/{01_tabs,02_import}.yaml`; `.eas/build/ios-test.yml`; `eas.json`; `scripts/{webSmoke.cjs,release-testflight.sh}`; `scripts/tests/`; `modules/snowlog-media/ios/Core/Tests/`; `.memory/testing.md`; `docs/verification/`; `.codex/release-prompt.md`.
