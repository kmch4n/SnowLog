# CLAUDE.md

@../.codex/AGENTS.md

The line above is an import, not a mention: Claude Code reads `CLAUDE.md` and never `AGENTS.md`,
so without it the shared conventions would never reach this session. It expands at launch.
**`.codex/AGENTS.md` is canonical** — if anything disagrees with it, AGENTS.md wins.

## Scope of this file

**Claude-specific guidance only.** This file is loaded into every session, so anything restated
from elsewhere costs tokens on every turn. Do not duplicate AGENTS.md or `.memory/` here.

What used to live here — the project snapshot, the non-obvious wiring, and the data contracts —
moved to [`.memory/wiring.md`](../.memory/wiring.md) on 2026-07-30. Read that before touching
startup order, i18n, haptics, thumbnails, or `app_preferences`.

## Where things are

| Looking for | Read |
| --- | --- |
| Contributor conventions (canonical) | `.codex/AGENTS.md` (imported above) |
| Cross-agent knowledge base — index first | `.memory/README.md` |
| Startup order, non-obvious wiring, data contracts | `.memory/wiring.md` |
| Rules both agents follow, and why | `.memory/agent-rules.md` |
| Implementation spec (data model, screens, flows) | `SnowLog.md` |
| Why this stack, and the design decisions | `docs/design-notes.md` |
| Versions, deps, scripts | `package.json` |
| Table definitions | `src/database/schema.ts` |

## Claude-specific

- **Respond in Japanese.** Code, comments, and repo artifacts (commits, issues, PRs) in English.
- **Never put durable project knowledge in Claude-private memory.** Codex cannot see it, so it
  becomes tacit knowledge. Write it to `.memory/` instead and keep that README's index in sync.
- `.claude/settings.local.json` is a personal, machine-local override, and is the one path in
  this directory that stays untracked.
