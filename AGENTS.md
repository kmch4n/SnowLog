# SnowLog Agent Instructions

This file is always loaded. Keep it minimal; consult linked material **only when relevant**.

## Context
- `docs/spec/README.md`: canonical English implementation specs; read affected chapters, not the entire corpus.
- `.memory/README.md`: shared project history and practical guidance; follow its index on demand.
- Use current code/tests to establish implemented behavior. Issues and unwired helpers are not shipped features.

## Working rules
- Design discussions and reviews are read-only unless implementation is requested.
- For behavioral or contract changes: update relevant `docs/spec/` **before** code, implement with tests, then reconcile with the final diff. See `docs/spec/invariants-and-change-control.md` for critical invariants. Update specs for refactors only when documented behavior or ownership changes.
- Protect existing user data. Generate migrations from `src/database/schema.ts`; never edit generated `drizzle/` SQL by hand. Keep affected Web shims and both locales aligned.
- Run relevant checks (`npm run lint`, `npx tsc --noEmit`, `npm test`, and Web/iOS verification where applicable). Report what actually ran and what remains unverified; see `.memory/testing.md`.
- Follow existing project conventions; details live in `.memory/agent-rules.md`. Record durable cross-agent knowledge in `.memory/`, not agent-private memory.

## Git and delivery
- Commits, pushes and GitHub writes for requested implementation need no additional approval. Default to `main` unless a branch/PR is requested or already used for the task.
- Use the owner's `kmch4n` identity for GitHub writes and both Git author/committer (personal or GitHub noreply email). Never substitute an AI/bot identity or add AI `Co-authored-by` trailers; verify account attribution, not display names alone. Use one logical change per commit and `[gitmoji] English present-tense summary` (≤72 characters). No AI attribution in commits, code, issues or PRs.
- Require explicit approval for destructive Git operations (force push, hard reset, branch deletion) and production releases/deployments. Do not commit secrets or generated build artifacts.
- Communicate in Japanese; write new code/comments/specs/commits/issues/PRs in English. Retain the language of existing Japanese documentation and `.memory/`.
