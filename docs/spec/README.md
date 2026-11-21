# SnowLog — Engineering Specification

> **Status:** living, as-built reference  
> **Baseline:** `main` at `848264a226be88b92cfff741ae4e695c2c9a9291` (2026-11-16)  
> **Documented:** 2026-11-21  
> **Application version:** 1.4.0  
> **Language:** English throughout this specification set

## Purpose and authority

These files describe the actual behavior, architecture, data, contracts, platform boundaries, and verification strategy of SnowLog sufficiently for a maintainer to understand and modify it without first reading every source file. They are **not** an aspirational backlog or a verbatim rendering of code. Claims are backed by named source modules and tests, rather than line numbers that move as code changes.

**The behavior of the current implementation is the factual baseline.** The specifications become the intended contract for changes *once an update has been reviewed and accepted*. If an existing specification and code disagree, do not silently presume either to be correct: record the drift, determine whether the code is a regression or the specification is stale, and reconcile both in the same work item.

A distinction used everywhere:

- **Shipping / connected:** reachable from current iOS application routes and startup flow.
- **Implemented but unconnected:** source code, database support, pure functions, or native infrastructure exists, but the user-facing flow does not invoke it.
- **Planned:** accepted requirements or investigation in an open issue, not a runtime feature.
- **Platform stub:** browser demonstration / test implementation, not production parity.

In particular, **Issue #86 is in progress**. Its storage-schema/backfill work is present, but its new identifier-only picker and controlled acquisition adapter are not yet connected to app import and playback. Do not accidentally describe the entire proposed workflow as shipped.

## Reading map

| Document | Questions it answers |
| --- | --- |
| [01-product-and-scope.md](01-product-and-scope.md) | Product, supported platforms, real capabilities, exclusions, status boundary |
| [02-system-architecture.md](02-system-architecture.md) | Packages, layers, routing, boot order, lifecycle, cross-component wiring |
| [03-persistence-and-migrations.md](03-persistence-and-migrations.md) | Every SQLite entity, keys, ownership, migration, backup semantics |
| [04-import-and-location.md](04-import-and-location.md) | Single/batch import, GPS, Photos permissions, staging, failures |
| [05-library-playback-and-deletion.md](05-library-playback-and-deletion.md) | Home, detail, source selection, autosave, bulk actions, safe deletion |
| [06-calendar-search-and-dashboard.md](06-calendar-search-and-dashboard.md) | Discovery, diary, seasons, metrics, duplicate detection |
| [07-settings-i18n-and-design.md](07-settings-i18n-and-design.md) | Settings, localization, preference defaults, design-system boundaries |
| [08-media-infrastructure.md](08-media-infrastructure.md) | Storage-mode migration, native Swift foundation, jobs, intended pipeline status |
| [09-web-and-companion-projects.md](09-web-and-companion-projects.md) | Web preview/stubs, Astro site, Remotion promotional video |
| [10-quality-and-delivery.md](10-quality-and-delivery.md) | Tests, CI, iOS validation, release configuration, operational limits |
| [11-invariants-and-change-control.md](11-invariants-and-change-control.md) | Non-negotiable contracts, traceability, required spec-first workflow |

## Source ownership and documentation relationships

| Source | Role |
| --- | --- |
| `docs/spec/` | **Current behavioral and technical contract**; update before changing behavior |
| `AGENTS.md` | Small, mandatory contributor and agent instructions; links here instead of duplicating detail |
| `README.md` | Public product introduction and pointers to technical documents |
| `SnowLog.md` | Preserved Japanese legacy technical overview; historical/supplemental, **not authoritative over this set** |
| `docs/design-notes.md` | Preserved design history and rationale; not necessarily current implementation |
| `.memory/` | Shared operational notes, decisions, testing traps and tracked drift; not a parallel specification |
| `docs/verification/` | Date-specific device and TestFlight observations; evidence, not a timeless contract |
| `docs/superpowers/` | Historical plans and scoped design proposals |
| GitHub Issues | Future work, accepted decisions not yet delivered, known defects |
| `src/`, `modules/`, `drizzle/` | Actual production and in-progress implementation |
| `pr/web/`, `pr/pv/` | Independent website and promotional-video projects |

Preserving the old documents is intentional. Do not delete, translate, or rewrite them merely because this specification exists. Update a legacy document only for a separate, justified maintenance change.

## How to use these specifications

1. Find the feature or invariant in this index and read its owning chapter plus relevant cross-cutting contracts.
2. Check the current GitHub issue and any in-progress branch for related design changes.
3. **Before source changes:** amend the affected specifications to state the desired behavior, edge cases, data transitions, failure handling, supported platforms and verification criteria.
4. Review the specification for contradictions and migration/compatibility consequences.
5. Implement and test against the amended contract; reconcile unexpected behavior rather than changing prose to rationalize it.
6. Submit specification and implementation changes together. A documentation-only PR can establish a baseline without pretending to deliver incomplete features.
7. In the PR description identify affected specifications, source modules, evidence and unverified areas.

Detailed gates and a change-impact matrix are in [11-invariants-and-change-control.md](11-invariants-and-change-control.md).

## Coverage and navigation conventions

- Paths are relative to the repository root; function names are stable evidence anchors.
- Dates in the database are Unix **seconds**, except where a source library explicitly supplies **milliseconds**. Date keys use device-local `YYYY-MM-DD`.
- Distinguish a video's **Photos identity** (`assetId`) from its **byte ownership** (`storageMode`).
- Use **MUST** for safety/compatibility contracts, **SHOULD** for conventions and **MAY** for optional behavior.
- Avoid asserting that an API/service exists merely because its type or proposed contract exists.
- No source-code comments, public README copy, or user-facing localizations are required to be English merely because `docs/spec/` is.

## Cross-cutting risk register

| Area | Current boundary |
| --- | --- |
| Offline operation | SQLite and locally held files work offline; iCloud-only Photos media can require network, and the current picker may download before selection returns |
| Mobile-data policy | Pure policy functions and preference persistence exist; end-to-end controlled acquisition is **not shipped** (#86) |
| Backups | OS iCloud Backup eligibility, **not** an in-app backup or sync engine |
| Device migration | Photos references may no longer identify the same video after device restore (#85) |
| Android | Expo configuration exists; the Android product is not supported |
| Web | Browser smoke/demo with shimmed storage and media, not a user-data Web client |
| Automated verification | JS tests, lint, TS, Web smoke in CI; iOS device behaviors still need manual/simulator checks |
| Accessibility and UX | Existing workflows are not guaranteed to satisfy every proposed issue; do not conflate open issues with implemented features |

## Re-baselining

Re-check this corpus against the latest `main` before any material code change. Update the baseline SHA and date **only after** reconciling the impacted chapters. For cross-module work, explicitly follow the references between import, playback, storage, startup and cleanup. A changed release number alone is not evidence that a specification is current.
