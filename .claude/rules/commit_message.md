# Commit Message Rules

## Format
```
[emoji] English commit message
```

## Emoji Guidelines
- Follow [gitmoji.dev](https://gitmoji.dev) standards
- Common emojis used in this project:
  - ✨ (`:sparkles:`) - New feature
  - 🐛 (`:bug:`) - Bug fix
  - 📝 (`:memo:`) - Documentation
  - 🎨 (`:art:`) - Code style/formatting
  - ♻️ (`:recycle:`) - Refactoring
  - 🔧 (`:wrench:`) - Configuration
  - 🚀 (`:rocket:`) - Performance improvement
  - 🥅 (`:goal_net:`) - Error handling
  - ✅ (`:white_check_mark:`) - Tests

## Examples from this project
```
[✨] Add deadline warning highlight and list features with toggle settings v1.3.0
[🐛] Fix duplicate course display in deadline list
[♻️] Remove complex custom name feature, keep pinned courses only
[📝] Update README with schedule customization features
```

## When to provide commit messages
- After implementing significant new features
- After major refactoring or improvements
- Before version releases
- When user explicitly requests

## IMPORTANT: Git Operations Policy
**NEVER automatically stage, commit, or push changes without explicit user request.**

- Only suggest commit messages when appropriate
- User will manually handle `git add`, `git commit`, and `git push`
- If user asks for commit message suggestions, provide them but do NOT execute git commands
- Only execute git commands (commit, push, etc.) when user explicitly requests it