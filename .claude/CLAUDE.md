# CLAUDE.md

SnowLog playbook for Claude Code. Synced 2026-05-07.

@../.codex/AGENTS.md

The line above is an import, not a mention: Claude Code reads `CLAUDE.md` and never `AGENTS.md`, so without it the Codex conventions would never reach this session. It expands at launch. Some guidance below overlaps what it says — that duplication is known and accepted; if the two ever disagree, treat `.codex/AGENTS.md` as canonical and fix the drift.

Authoritative sources beyond this file:
- `.memory/README.md` — **read first.** Cross-agent shared knowledge base (see below)
- `package.json` — versions, deps, scripts
- `src/database/schema.ts` — table definitions
- `SnowLog.md` — deep architecture / feature spec
- `.codex/AGENTS.md` — canonical contributor conventions (imported above)

This file lists only what is **not** derivable from those: rules, conventions, gotchas, and non-obvious wiring.

## Shared Knowledge Base

`.memory/` is shared by Claude Code, Codex, and humans, and is tracked in git. This file and `.codex/AGENTS.md` are tracked too (since 2026-07-15); only `.claude/settings.local.json` stays ignored as a personal, machine-local override. Read `.memory/README.md` at the start of a task and follow its index.

Because CLAUDE.md and AGENTS.md are separate files, they drift. Rules that both agents must follow belong in `.memory/agent-rules.md`, not duplicated here.

**Do not put durable project knowledge in Claude-private memory.** It becomes tacit knowledge Codex cannot see. Write it to `.memory/` instead, and keep that README's index in sync.

## Interaction Rules
- Respond in Japanese. Code, comments, and repo artifacts (commits, issues, PRs) in English.
- TypeScript strict, 4-space indent, double quotes. Keep files within ~500–700 lines. No `any` without inline justification.
- Naming: API clients → `cl`, components → PascalCase, functions/vars → camelCase, constants → UPPER_SNAKE_CASE, hooks → `useXxx`.
- npm + `package-lock.json`. Use the `@/` alias for imports from `src/`.
- Lint via `npm run lint` (Expo ESLint).

## Git
- Agents may run `git add` / `commit` / `push` and GitHub write actions at any time, without asking first. **This overrides the stricter "explicit approval" policy in the global `~/.claude/CLAUDE.md` and `~/.claude/rules/commit_message.md` — inside SnowLog, this file wins.** Rationale in `.memory/agent-rules.md`.
- **Split commits.** One logical change per commit; never bundle unrelated work. Prefer several small commits over one large one.
- Destructive ops (`reset --hard`, force push, branch delete) still require an explicit instruction.
- Commit format: `[gitmoji] English message` (≤72 chars, present tense). No AI attribution, no `Co-Authored-By`.
- Before drafting a commit, review the last 10 commits and `~/.claude/rules/commit_message.md`.
- Verify the active git identity belongs to the user (`kmch4n`); stop and report if it looks like a bot/service account.

## Project Snapshot

| Item | Detail |
| --- | --- |
| App | SnowLog — offline-first ski video logbook + daily diary |
| Version | 1.2.0 (App Store) |
| Stack | Expo SDK 55 / RN 0.83.6 / React 19.2 / Expo Router v4 (NativeTabs, Liquid Glass) / expo-sqlite + Drizzle / i18n-js v4 + expo-localization |
| Target | iOS primary. Android/Web are verification stubs. **EAS Dev Build required — Expo Go is incompatible with SDK 55.** |
| Screens | Home (timeline + favorites), Dashboard, Calendar (month/week), Search, Settings (techniques / tags / favorite-resorts / calendar / duplicate-candidates) + a "delete unused files" maintenance row, Import modal, Video detail, Diary |

## Repo Map (top level only — use `LS` for sub-trees)

```
src/app/         Routes. (tabs)/, settings/, video/[id], video-import
src/components/  UI (FilterBar, VideoCard*, Diary*, Calendar*, dashboard/*, ThumbnailMigrationScreen, ...)
src/hooks/       useVideos, useDashboard, useCalendarEnhanced, useDiaryEntry, useSelectionMode, useAppPreference, useTranslation, ...
src/services/    importService, mediaService, thumbnailService, exportService, duplicateDetectionService, videoDeletionService, managedVideoFileService, hapticsService, bulkImportSummaryService, thumbnailMigrationService, orphanedFileCleanupService, updateCheckService
src/database/    schema.ts + repositories/
src/i18n/        index.ts, useTranslation.ts, types.ts, locales/{ja,en}.ts
src/constants/   colors, icons, techniques, diaryOptions, skiResorts.json (378 resorts). `theme.ts` + Expo template companions are unused — see open cleanup issue.
src/utils/       dateUtils, geoUtils, calendarUtils, parseTechniques, searchRouteParams
src/types/       Runtime types (Video, VideoWithTags, FilterOptions, DayInfo, DiaryEntry, Season, DashboardStats, ...)
drizzle/         Generated migrations — never edit manually; regenerate via `npm run db:generate`
locales/         ja.json, en.json — iOS InfoPlist permission strings (see "iOS permissions" gotcha below)
scripts/         patchImageUtilsCache.js (postinstall / eas-build-post-install) + tests/ (see Testing)
pr/web/          Astro landing page. Separate project with its own node_modules, tracked in git
```

**Web shims**: native-dependent modules (repos, services, native-only screens) need a `.web.ts` / `.web.tsx` companion. Don't import a native-only module from a web-reachable path without one.

## Non-obvious wiring (the gotchas)

- **Boot order in `src/app/_layout.tsx`** — Drizzle `useMigrations` runs first. On success: differential `seedTechniqueOptions`, then the thumbnail URI migration (gated by `app_preferences.thumbnail_migration_version`, renders a blocking `ThumbnailMigrationScreen` while running). After the thumbnail phase resolves to `done`, `InteractionManager.runAfterInteractions` triggers three background jobs: `repairInvalidCapturedAt`, `cleanupOrphanedFiles`, and `getOptionalUpdateInfo` (`updateCheckService` — hits the App Store Lookup API and may raise the optional-update `Alert`). The Stack (wrapped in `GestureHandlerRootView` + `ThemeProvider`) renders in parallel. Locale is resolved once at module init in `src/i18n/index.ts` and is never re-read. Don't reorder without checking each step's preconditions.
- **Bulk import summary handoff** — on completion `importService` calls `bulkImportSummaryService.setPendingBulkImportSummary({success, skipped, error})`. The home screen drains it via `consumePendingBulkImportSummary` on focus and surfaces the alert. Do **not** show the summary from the import modal directly.
- **i18n is device-locale-only (no runtime switching)** — `src/i18n/index.ts` reads `expo-localization.getLocales()[0]?.languageCode` once at module init, normalises non-`ja` to `en`, and pins `i18n-js`'s locale to that value. `useTranslation()` returns `{ t, locale }` only — there is no preference / setter API, no persisted `locale` key, and the in-app language picker was removed in `bab0b45`. Users change language by changing iOS system language. The `useSyncExternalStore` plumbing in `useTranslation.ts` is currently inert (open cleanup issue). Type parity between `locales/ja.ts` and `locales/en.ts` is still enforced by `Translations = typeof ja`.
- **Haptics — always via `services/hapticsService.ts`** (`hapticLight/Medium/Selection/Success/Warning/Error`). The `safeFire` wrapper swallows `UnavailabilityError` from `expo-haptics` so a stale dev-client binary cannot crash callers. Don't import `expo-haptics` directly elsewhere.
- **Thumbnails are `documentDirectory`-relative** so iOS container relocations don't invalidate them. Missing files are tagged with `THUMBNAIL_MISSING_SENTINEL`. Never persist absolute thumbnail URIs.
- **SQLite** — opened with `foreign_keys = ON` and WAL mode. `setTagsForVideo` runs in a transaction so partial tag updates can't leak.
- **iOS permission localization** — edit `locales/ja.json` + `locales/en.json` at the repo root, wired by `app.json` `expo.locales` + `CFBundleLocalizations: ["ja","en"]`. The inline `infoPlist.NSPhoto*UsageDescription` block in `app.json` is the **Japanese fallback only** — never rely on it for actual localization.
- **Typed routes / React Compiler** — `app.json` has `typedRoutes: true` and `reactCompiler: true`. New routes must satisfy generated types; don't bypass with casts.

## Data Contracts (delta from `src/database/schema.ts`)

Schema is canonical in `src/database/schema.ts`. The non-obvious bits:
- `videos.techniques` is JSON-encoded; parse via `parseTechniques`. Files stay in place (reference-based) — only thumbnails and managed copies live in `documentDirectory`.
- `tags(name, type)` is unique (migration `0007`). `tag.type` ∈ `"technique" | "skier" | "custom"`.
- `favorite_resorts.name` unique. `diary_entries.dateKey` (YYYY-MM-DD) unique — one entry per day.
- `app_preferences` is a key-value store. Keys actually in use today: `capturedAt_repair_version`, `thumbnail_migration_version`, `home_sort_order`, `weekStartDay` (camelCase by historical accident — do not migrate to snake_case without a data migration). Upgraded users may still have a stale `locale` row from before the language picker was removed; cleanup is tracked in an open issue.

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install deps (runs `patchImageUtilsCache.js` postinstall) |
| `npm run start` / `ios` / `web` | Metro / iOS sim / Web stub |
| `npm run lint` | ESLint via Expo |
| `npm run db:generate` / `db:studio` | Drizzle migration gen / Studio |
| `npm run reset-project` | Clear caches |

## Testing

`scripts/tests/` holds 9 `node:test` files (58 cases). No `test` npm script — run them with `node --test "scripts/tests/*.test.cjs"` (quote the glob; a directory argument fails on Node 25 / Windows). Seven compile the target `.ts` with `tsc` and assert on real behavior; two (`homeSwipeDelete`, `videoDetailKeyboardAccessory`) match **source text via regex**, so a refactor can break them while the app still works. How to compile depends on the target's imports — an aliased (`@/`) import needs a self-contained temp tsconfig, and an aliased *value* import also needs the emit to land in `node_modules/@`. Date tests pin `process.env.TZ`; verify new ones with `TZ=UTC`. **A green assert proves nothing until you break the code and watch it fail** — see `.memory/testing.md`. The `expo-symbols` / `expo-haptics` choke points are enforced by `no-restricted-imports` in `eslint.config.js`, not by these tests.

Manual verification on iOS sim remains primary. After schema, import, export, or dashboard changes, run the full flow: migrate → import → search → export. Re-check Web only when touching `.web.tsx` paths. Run `npm run lint` before a PR.
