# Changelog

## [1.0.2] - 2026-09-14

### Fixed
- `claude` binary resolution no longer relies on a single hardcoded fallback
  path. It now tries, in order: an explicit `claudeCommit.claudePath` (only
  if it still exists on disk), the user's login shell `PATH` (so nvm/npm
  global/custom prefixes are picked up automatically), and a list of common
  install locations (`~/.claude/local`, `~/.local/bin`, `~/.npm-global/bin`,
  `~/.npm/bin`, `/usr/local/bin`, `/opt/homebrew/bin`, `/usr/bin`).
- `claudeCommit.claudePath` is now scoped `machine` so VS Code Settings Sync
  never propagates it between computers — setting it explicitly on one
  machine (different user or install method) can no longer break every
  other machine sharing the same synced settings.
- A missing `claude` binary now shows a clear error listing exactly what was
  checked, instead of silently trying one guessed path.

## [1.0.0] - 2026-06-27

### Added
- Generate commit messages from staged diff using `claude -p`
- Configurable language: Spanish / English
- Configurable style: Short (single line) / Extended (title + body)
- Configurable format: Conventional Commits / Emoji (gitmoji) / Simple
- Optional scope in Conventional Commits
- Persistent configuration saved globally via VS Code settings
- In-panel configure button (⚙) with interactive QuickPick
- Keyboard shortcut `Ctrl+Shift+Alt+G`
- Automatic truncation of large diffs
- Strips VS Code/Claude Code environment variables to avoid MCP conflicts
