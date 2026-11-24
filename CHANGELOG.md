# Changelog

## [1.0.5] - 2026-11-24

### Fixed
- "Prompt is too long · the request is ~1227851 tokens": `claude -p` expands
  every `@path` in the prompt into attached file/folder contents, so diffs with
  `@scope/package` imports or `@/src` aliases pulled in hundreds of thousands
  of tokens. Every `@` in the diff is now neutralized with a zero-width space.
- `maxDiffLines` alone didn't bound size (minified files, lockfiles, base64):
  lines over 400 chars are clipped, a new `claudeCommit.maxDiffChars` cap
  (default 60000) applies, and lockfiles, `*.min.*`, `*.map`, `*.snap`, `*.svg`,
  `dist/`, `build/`, `out/` and `vendor/` are left out of the diff body (they
  still appear in the `--stat` file summary sent first).
- `claude -p` now runs from an empty temp dir instead of the repo, so the
  repo's CLAUDE.md / project memory are not loaded.

## [1.0.4] - 2026-11-24

### Fixed
- "Claude error: claude exited with code 1" (or an empty message): `claude -p`
  ran as a full agent session, picking up the global CLAUDE.md, hooks, tools
  and MCP servers. A vault Stop hook kept blocking the end of the run when
  VS Code had inherited `MEMORY_PREFLIGHT_RECEIPT_ID`. The call now runs with
  `--tools "" --disable-slash-commands --strict-mcp-config
  --no-session-persistence` and strips that variable from the environment.
- Error messages now include stdout when stderr is empty.

### Added
- `claudeCommit.model` setting (default `haiku`): fast and cheap for commit messages.

## [1.0.3] - 2026-09-30

### Fixed
- Multi-root / multi-repo windows: the command always used the first
  repository (`api.repositories[0]`), so clicking the button on another
  repo reported "No staged changes". It now uses the repository whose SCM
  title button was clicked; otherwise the selected repo in the SCM view,
  the active editor's repo (if it has staged changes), the only repo with
  staged changes, or asks via a quick pick.
- The "No staged changes" warning now names the repository it checked.

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
