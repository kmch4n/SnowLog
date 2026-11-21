# SnowLog — Implementation Specification

> **Status:** Current-implementation reference
> **Baseline:** `main` at `848264a` (reviewed 2026-11-21)
> **Language:** English
> **Scope:** iOS app, browser preview, native media groundwork, and companion website/video

## Purpose

These documents explain the system sufficiently to navigate, extend, and review SnowLog without first reading its entire codebase. They specify **observable behavior, data contracts, component ownership, failure semantics, invariants, and current integration status**. They are not a transcript of source files or a proposal masquerading as shipped functionality.

The baseline names a reviewed commit, not a permanent release. When changing an implementation, update the affected spec **before** changing the code and revalidate its assertions against the final diff. Any meaningful code/spec discrepancy is a defect to resolve, not a reason to leave the spec stale.

## Reading map

| Document | Primary questions answered |
| --- | --- |
| [Product and status](product-and-status.md) | What does SnowLog do? What actually works, what is restricted, and what is not shipped? |
| [System architecture](architecture.md) | How are screens, repositories, services, native code, and standalone projects separated? |
| [Source module catalog](module-catalog.md) | Where is each tracked application, native, website, film, and utility module located? |
| [Data model](data-model.md) | What is persisted, in which shape, with what uniqueness and ownership constraints? |
| [Import and resorts](import-and-resorts.md) | How are videos selected, staged, deduplicated, tagged, and associated with ski resorts? |
| [Library and playback](library-and-playback.md) | How are files referenced, copied, resolved, deleted, and protected against data loss? |
| [Calendar, search and analytics](calendar-search-and-analytics.md) | What are the date, filtering, diary, and statistics contracts? |
| [Settings and presentation](settings-and-presentation.md) | Which settings are editable; how do locale, UI, accessibility and haptics behave? |
| [Startup and maintenance](startup-and-maintenance.md) | What is the critical initialization order and how are migrations, cleanup, updates and backup handled? |
| [Media-priority infrastructure](media-priority-infrastructure.md) | Which parts of Issue #86 exist only as contracts and infrastructure, not as connected product flows? |
| [Web and promotional projects](web-and-promotion.md) | How does the Expo Web preview differ from iOS, and what are Astro and Remotion responsible for? |
| [Verification and releases](verification-and-release.md) | Which automated and manual gates establish confidence, and where are their limitations? |
| [Traceability](traceability.md) | Where should an engineer start for each screen, state transition, decision, and regression? |

**Suggested first reading:** product → architecture → data model → the target feature → verification. For file lifecycle changes, read *library and playback*, *startup and maintenance*, and *media-priority infrastructure* together.

## Terminology and evidence labels

- **Active / wired:** The shipping iOS screen or lifecycle actually invokes the behavior.
- **Implemented infrastructure / unwired:** Types, functions, repository tables, or native helper code exist and may have tests, but no shipping interaction calls the complete flow.
- **Proposed:** A documented intention or Issue acceptance criterion not implemented in the product.
- **Web preview:** A deterministic development surface, not an Android implementation, iOS equivalence test, or a production website.
- **App-managed copy:** Movie bytes in SnowLog's own `Documents/videos/` directory. A Photos *reference* contains metadata and an external Photos identity instead.
- **Local date:** Calendar date in the user's device time zone; Unix timestamps in the DB use seconds, except explicitly stated millisecond fields.

All `src/`, `modules/`, `drizzle/`, and companion-project paths refer to this repository. Source paths and stable symbol names are included throughout; line numbers are deliberately avoided because they become stale quickly.

## Precedence and retained historical material

1. For **what the current app does**, inspect the current executable source and tests; keep this specification reconciled with them.
2. For **what should be changed next**, the accepted requirement is recorded here first, before implementation. Open Issues remain the source for backlog and proposed functionality until accepted and implemented.
3. `SnowLog.md` is intentionally retained as an earlier Japanese technical explanation; `docs/design-notes.md` retains architectural rationale; `.memory/` retains cross-agent history, known pitfalls, and verification notes. None is deleted or mechanically translated by this specification.
4. `AGENTS.md` is the canonical contributor policy; this directory specifies the system, not the Git operating procedure.

## Change discipline

For a feature, bug fix, API/schema modification, UI behavior change, or migration:

1. Find affected contracts using [traceability](traceability.md) and identify the current wiring.
2. Update the relevant specification sections **first**, including data shape, success, failure, backward compatibility, and test obligations.
3. Implement only the approved behavior; update schema migrations, Web shims and translations where applicable.
4. Add/adjust tests that can fail against the old behavior. Perform device checks for native and file-lifecycle changes.
5. Re-read the resulting code and diff; remove speculative or outdated claims; update links and status distinctions.

A purely internal refactor that leaves all documented contracts intact can state "no specification changes" in its change review, with justification. Documentation-only changes require consistency checks rather than a fabricated native test claim.
