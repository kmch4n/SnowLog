# Engineering Invariants and Specification-First Change Control

## The governing development rule

**For any new feature or change to observable behavior, update the applicable `docs/spec/` files first, then change implementation, then verify against the updated specification.** This is the repository's **specification-first development** rule, not an excuse to blindly implement an unreviewed design.

The rule applies to product UI, persistence format, API contracts, background processes, media acquisition, permission behavior, screen/navigation logic, network policy, errors, analytics/privacy disclosures, tests and release behavior. A pure refactor that deliberately preserves externally observable behavior must still reconcile specifications if the described architecture, ownership or testing entry points change.

**Issue proposals are not shipped behavior.** A feature can have an accepted future design in an issue while the current specification correctly reports “not implemented.” Only after implementation and verification should the as-built chapter be promoted to “connected.”

## Change lifecycle and expected artifacts

1. **Establish baseline.** Read `AGENTS.md` and `.memory/README.md`, relevant `docs/spec/` chapters, current code, tests and linked Issues. Identify where documentation already differs.
2. **Describe the proposed delta.** Amend the owning spec with user-visible behavior, input/output contracts, invalid states, data migration, error and cancellation rules, platform scope, privacy/network costs and acceptance checks.
3. **Review assumptions.** If facts or product decisions remain unknown, mark them explicitly. Distinguish decisions from conjecture. Check cross-file invariants and compatibility with already-stored user data.
4. **Implement.** Modify the smallest coherent code surface. Prefer separation of route composition, hooks, services, repositories and pure decisions; avoid new hidden coupling.
5. **Add / adjust tests.** Target the new contract, include negative and failure paths, verify a new test can fail under a deliberate controlled violation, and account for native/device-only behavior.
6. **Reconcile actual behavior.** Run checks and examine the resulting UX; revise spec and implementation together where the evidence warrants. Do not alter prose merely to justify an accidental regression.
7. **Deliver.** PR description lists updated spec chapters, source diff, tests/manual evidence, migration/privacy implications and explicitly unverified items. Avoid false statements that a planned module has been integrated.
8. **Maintain.** Revisit affected documentation after review feedback and before merge. Preserve unrelated historical notes instead of performing scope-creeping translations.

A documentation-only baseline PR, such as creation of this corpus, may contain **no application code changes**. The point is to establish and cross-check the current contract; it must not be represented as implementation of outstanding issues.

## Invariants with high regression cost

### Database and migration
- MUST use generated Drizzle migrations, not edit `drizzle/` SQL by hand.
- MUST gate storage backfill after SQL migrations and before thumbnail repair/cleanup or media access.
- MUST use synchronous transaction callbacks with the Expo SQLite driver; no `await` midway through an intended atomic operation.
- MUST preserve user data on upgrades. Existing technique deletions and persisted preferences must not be reset by “first run” logic.
- MUST treat locally stored time as Unix seconds, and distinguish milliseconds from Photos.
- MUST preserve case-insensitive unique ownership of managed movie paths.

### Media and filesystem
- MUST distinguish Photos identity (`assetId`) from byte ownership (`storageMode`).
- MUST store managed movie/thumbnail paths relative to the current app container.
- MUST not infer file absence from limited/no Photos authorization.
- MUST re-resolve previously unavailable media when access returns.
- MUST not silently fall back to Photos when a `copy` file is missing.
- MUST delete database rows **before** deleting their owned filesystem bytes.
- MUST shield newly written/protected files from orphan cleanup and honor its five-minute grace.
- MUST preserve existing synthetic-copy behavior while new policies are developed.
- A future **network-enabled** acquisition MUST be gated on active intent and attempt-specific permission. No unknown path may silently qualify as Wi-Fi.

### Import and integrity
- MUST not create duplicate identified Photos rows.
- MUST not persist an unresolvable, limited-access selected identity as a “ready” reference.
- MUST clean stage files and avoid out-of-order asynchronous UI updates.
- MUST keep uncertain GPS identification user-confirmable; no location is still a valid import.
- MUST retain failure reasons instead of flattening missing/auth/network/cancel/space into a generic success.
- Future transfer commit MUST persist verified output before promote-before-DB commit, with recoverable rollback behavior.

### User experience and platforms
- MUST keep both runtime locale dictionaries structurally aligned and preserve system-language selection.
- SHOULD use centralized icon/haptics/motion/color wrappers and accessible semantic controls.
- MUST not present Web mock/stub functionality as a functional production app.
- MUST not promise unsupported Android, complete cross-device restoration, automatic in-app iCloud sync, or a fully shipped media priority feature.
- MUST not imply a Git-tracked website video has been deployed without verifying the hosting surface.

## Change-impact index

| Change type | Spec to update first | Principal code/test evidence |
| --- | --- | --- |
| New route/feature | `product-and-status.md`, `architecture.md`, owning chapter | `src/app/`, route tests, simulator |
| Schema/key/index/DB query | `data-model.md`, affected feature chapter | `src/database/schema.ts`, repositories, migration tests |
| Single/batch import or GPS | `import-and-resorts.md`, `library-and-playback.md` if ownership changes | `src/app/video-import.tsx`, `importService`, GPS and import tests |
| Media priority/native pipeline | `media-priority-infrastructure.md`, `import-and-resorts.md`, `library-and-playback.md`, `verification-and-release.md` | Swift Core, policy, transfer tests, issue #86, device |
| Playback/availability/autosave | `library-and-playback.md` and `data-model.md` | `usePlaybackSource`, `useVideoDetail`, playback tests |
| Deletion/cleanup | `library-and-playback.md`, `data-model.md`, `invariants-and-change-control.md` | deletion/cleanup services, injection tests |
| Date/calendar/diary | `calendar-search-and-analytics.md`, `data-model.md` | `dateUtils`, calendar hook, diary repo, tests |
| Search/dashboard/duplicates | `calendar-search-and-analytics.md` | repositories, pure aggregators, duplicate tests |
| Localization/settings/visual UI | `settings-and-presentation.md`, product changes in `product-and-status.md` | locale files, settings routes, lint/device |
| Web/Astro/Remotion | `web-and-promotion.md`, `verification-and-release.md` | platform shims, companion package scripts |
| CI/build/release | `verification-and-release.md`, `architecture.md` if architectural | workflow YAML, EAS config, release scripts |
| Privacy/data retention/backup | `product-and-status.md`, `data-model.md`, `media-priority-infrastructure.md`, `web-and-promotion.md` | data paths, app claims and live site |

The table is a **minimum**, not permission to ignore a transitive effect. A cross-cutting change may need several chapters and an updated diagram.

## Evidence standards and issue hygiene

Each material specification assertion should have at least one traceable source module, test, release artifact or **explicitly dated** manual observation. Prefer symbol names to line numbers. Specify whether the evidence is:
- **Code-verified:** reviewed implementation and call sites, not necessarily run;
- **Test-verified:** automated checks actually run and observed passing, including limits;
- **Device-verified:** named device/OS/build, steps and observed result;
- **Unverified:** design assumption, known gap, issue proposal, or behavior not exercised.

When a spec and code conflict, identify it clearly. An open Issue retains future change intent; it is **not** an alternative current-spec authority. Record unimplemented ideas there rather than inserting them as present-tense capabilities.

Do not assert current deployment state based only on a branch. Do not state “all tests pass” unless they were run or their CI results were observed. No AI attribution belongs in commits, issues or PR descriptions under existing contributor policy.

## PR acceptance checklist

- [ ] Baseline commit and scope are clear; no unrelated refactoring.
- [ ] Affected specifications were edited **before** implementation, or this is explicitly a baseline-only documentation PR.
- [ ] Functional behavior, edge cases, failure paths and UX are sufficiently specified to review without reading every code file.
- [ ] Database migration, compatibility, ownership, platform and privacy consequences were examined.
- [ ] Contract assertions match actual wiring, not only dead/unconnected helper modules.
- [ ] Tests are tied to the changed invariants; manual/native checks are documented where required.
- [ ] README/AGENTS/agent pointers stay accurate; existing legacy notes remain available.
- [ ] The PR states exactly what was tested and what was not tested.
- [ ] Commit messages match the repository's bracketed-gitmoji, English, present-tense convention and reflect **meaningful logical units**.
- [ ] No undocumented production deployment, destructive git operation or unrelated issue closure occurred.

## Document retention and precedence

The legacy Japanese `SnowLog.md`, `docs/design-notes.md`, `.memory/` and historical implementation plans are **retained**. Their useful decisions and background may inform review, but their older behavioral claims must be checked against the code and current spec. Update cross-references rather than deleting history to make the repository appear tidy.

For changes in ambiguity: product decisions require maintainer intent; the *as-built state* is established from implementation and verifiable runtime evidence; the approved spec describes the target behavior to which code must then conform.

**Related:** [README.md](README.md), [traceability.md](traceability.md), [architecture.md](architecture.md), [data-model.md](data-model.md), [media-priority-infrastructure.md](media-priority-infrastructure.md), `AGENTS.md` and `.memory/README.md`.
