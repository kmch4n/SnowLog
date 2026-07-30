# Repository Guidelines

Canonical contributor conventions for SnowLog, shared by Codex, Claude Code, and humans.
`.claude/CLAUDE.md` imports this file and adds only Claude-specific notes.

**This file is loaded into every session. Keep it short.** Detail belongs in `.memory/`,
which is read on demand. If you are tempted to explain something at length here, write it
in `.memory/` and leave a pointer.

## Shared Knowledge Base — Read First

`.memory/` is the cross-agent knowledge base, tracked in git. **Read `.memory/README.md` at the
start of a task** and follow its index. It records what the code cannot show: known doc/code
drift, how to run the tests, non-obvious wiring, agreed agent rules, and the backlog.

When you learn something durable that does not belong in code, add it there — never to an
agent-private memory — and keep the index in sync.

| Topic | File |
| --- | --- |
| Rules both agents follow, and the reasoning | `.memory/agent-rules.md` |
| Startup order, non-obvious wiring, data contracts | `.memory/wiring.md` |
| How the tests actually work, and their traps | `.memory/testing.md` |
| Where the docs disagree with the code | `.memory/doc-drift.md` |

## Project Structure

Expo Router app. Routes in `src/app` (tabs in `src/app/(tabs)`, features in `src/app/video` and
`src/app/settings`). Shared UI in `src/components`, reusable logic in `src/hooks`, business logic
in `src/services`, helpers in `src/utils`, shared types in `src/types`. Schema and repositories in
`src/database`; **`drizzle/` is generated — never edit it by hand.** Static assets in `assets/`,
utility scripts in `scripts/`. `pr/web` (Astro site) and `pr/pv` (Remotion video) are independent
projects with their own `node_modules`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install deps (runs the image cache patch on postinstall) |
| `npm run start` / `ios` / `android` / `web` | Metro / per-platform run |
| `npm run lint` | ESLint through Expo |
| `npm run db:generate` / `db:studio` | Regenerate Drizzle migrations / inspect the schema |
| `node --test "scripts/tests/*.test.cjs"` | Tests — there is no `test` script. Quote the glob. |

## Coding Style & Naming

TypeScript `strict`, four-space indentation, double quotes. No `any` without an inline
justification. Prefer small focused modules; keep files within ~500–700 lines. Route files stay
composition-only — push persistence and orchestration into hooks, services, or repositories.

PascalCase components (`VideoCard.tsx`), camelCase functions and vars, UPPER_SNAKE_CASE constants,
`useXxx` hooks (`useVideos.ts`), API clients named `cl`. Use the `@/` alias for imports from `src`.
npm with `package-lock.json`.

User-facing strings go through `useTranslation()` from `@/i18n/useTranslation`, or the module-level
`t` from `@/i18n` outside React. Keep `src/i18n/locales/ja.ts` and `en.ts` in sync — the
`Translations = typeof ja` annotation enforces it at compile time. iOS permission descriptions live
in `locales/ja.json` / `locales/en.json` at the repo root; the inline `infoPlist` block in
`app.json` is the Japanese fallback only.

Native-dependent modules need a `.web.ts` / `.web.tsx` companion. `tsc` cannot detect a missing
export in a shim, so check the pair by hand — see `.memory/doc-drift.md`.

## Testing

Run with `node --test "scripts/tests/*.test.cjs"`. Automated coverage is thin and some tests match
source text with regexes, so **a green assert proves nothing until you break the code and watch it
fail.** How to compile a target depends on the shape of its imports. Both points, and the rest of
the mechanics, are in `.memory/testing.md` — read it before adding a test.

Manual verification carries the load. Before finishing: run `npm run lint` and verify the affected
flow on iOS. For database changes, regenerate migrations, start from a clean local database, and
walk migrate → import → search → export. Re-check Web only when touching `*.web.tsx`.

## Git

Agents may run `git add`, `git commit`, `git push`, and GitHub write actions at any time, without
asking first. **This overrides the stricter "explicit instruction" policy in the global
`~/.codex/AGENTS.md` and `~/.claude/CLAUDE.md` — inside SnowLog, this file wins.** Do not carry
that relaxation to other projects.

- **Commit directly to `main`. Do not create a branch or a PR unless asked.** This repo is
  single-developer with a linear history; branching breaks that convention. Many agents default to
  branching — do not.
- **Destructive operations still require an explicit instruction**: `reset --hard`, force push,
  branch deletion.
- **One logical change per commit.** Never bundle unrelated work; prefer several small commits.
- Format: `[gitmoji] English message`, ≤72 chars, present tense (`[✨] Add seasonal dashboard tab`).
  Review the last 10 commits before drafting.
- **No AI attribution anywhere** — not in commits, issues, comments, or PRs. No `Co-Authored-By`.
- Verify the active git identity is `kmch4n` (`kmchan@kmchan.jp`) before writing. If it looks like a
  bot or service account, stop and report.
- Treat design discussion and review as read-only: do not start editing until implementation is
  explicitly requested.

## Security & Configuration

Keep secrets in ignored `.env` files. Do not commit `.expo/`, `ios/`, `android/`, debug logs, or
build artifacts. Treat `scripts/patchImageUtilsCache.js` as build infrastructure. Verify
permission-related changes on a real device when editing media import or file system code.
Never deploy to production without explicit approval.
