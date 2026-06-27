# Changelog

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
