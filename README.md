# Claude Commit Message

> Generate git commit messages from your staged diff using [Claude Code](https://claude.ai/code) — directly from the VS Code Source Control panel.

![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/ericrodriguez.claude-commit-message?label=VS%20Code%20Marketplace)
![License](https://img.shields.io/github/license/ericrodriguez/vscode-claude-commit)

---

## Requirements

- [Claude Code](https://claude.ai/code) CLI installed (`claude` available in `~/.local/bin/` or `PATH`)
- VS Code 1.76+
- A git repository with staged changes (`git add` before generating)

---

## How it works

### 1 — Stage your changes

```
SOURCE CONTROL
┌─────────────────────────────────────────┐
│ CHANGES                         + ↺ ··· │
│                                         │
│  ▼ Staged Changes                       │
│    M  src/auth/login.ts         +  −    │
│    A  src/auth/token.service.ts +       │
│                                         │
│  ▼ Changes                              │
│    M  package.json              +  −    │
└─────────────────────────────────────────┘
```

### 2 — Click ✦ to generate

The **✦ (sparkle)** button and **⚙ (gear)** button appear in the Source Control panel header after installing the extension:

```
SOURCE CONTROL                  ✦  ⚙  ···
┌─────────────────────────────────────────┐
│  Message (Ctrl+Enter to commit)         │
│  _                                      │
└─────────────────────────────────────────┘
```

Click **✦** — Claude reads the staged diff and writes the message directly into the input box:

```
SOURCE CONTROL                  ✦  ⚙  ···
┌─────────────────────────────────────────┐
│  feat(auth): add JWT token service      │
│                                         │
│  Centralizes token creation and         │
│  validation to remove duplicated logic  │
│  across auth controllers.               │
└─────────────────────────────────────────┘
```

> **Keyboard shortcut:** `Ctrl+Shift+Alt+G`

---

## Configuration

Click **⚙** to open the interactive configuration panel — all changes are saved globally and persist across sessions:

```
Claude Commit — Configuration
─────────────────────────────────────────────────────
  🌐 Language
─────────────────────────────────────────────────────
  $(check) 🇦🇷  Español
           🇺🇸  English
─────────────────────────────────────────────────────
  📝 Style
─────────────────────────────────────────────────────
  $(check) 📝  Short (single line)
           📄  Extended (title + body)
─────────────────────────────────────────────────────
  🔖 Format
─────────────────────────────────────────────────────
  $(check) 🔖  Conventional Commits
           ✨  Emoji (gitmoji)
           💬  Simple (no prefix)
─────────────────────────────────────────────────────
  🔍 Scope
─────────────────────────────────────────────────────
  $(check) ➖  No scope  (feat: ...)
           🔍  Include scope  (feat(auth): ...)
─────────────────────────────────────────────────────
```

You can also configure via **Settings** (`Ctrl+,` → search "Claude Commit"):

| Setting | Default | Options |
|---|---|---|
| `claudeCommit.language` | `spanish` | `spanish` / `english` |
| `claudeCommit.style` | `short` | `short` / `extended` |
| `claudeCommit.format` | `conventional` | `conventional` / `emoji` / `simple` |
| `claudeCommit.includeScope` | `false` | `true` / `false` |
| `claudeCommit.claudePath` | _(auto)_ | Full path to `claude` binary |
| `claudeCommit.maxDiffLines` | `500` | `50`–`5000` |

---

## Output examples

### Conventional Commits — Short — Español
```
feat(auth): agregar servicio de tokens JWT
```

### Conventional Commits — Extended — Español
```
feat(auth): agregar servicio de tokens JWT

Centraliza la creación y validación de tokens para eliminar
lógica duplicada en los controladores de autenticación.
```

### Conventional Commits — Extended — English
```
feat(auth): add JWT token service

Centralizes token creation and validation to remove duplicated
logic scattered across auth controllers.

Closes #142
```

### Emoji — Short — Español
```
✨ agregar servicio de tokens JWT
```

### Emoji — Extended — English
```
✨ add JWT token service

Centralizes token logic that was previously duplicated
across multiple auth controllers.
```

### Simple — Short — English
```
Add JWT token service for centralized auth logic
```

---

## Installation

### From VS Code Marketplace

Search for **"Claude Commit Message"** in the Extensions panel (`Ctrl+Shift+X`), or:

```bash
code --install-extension ericrodriguez.claude-commit-message
```

### Manual (development)

```bash
git clone https://github.com/ericrodriguez/vscode-claude-commit
ln -sfn "$(pwd)/vscode-claude-commit" ~/.vscode/extensions/ericrodriguez.claude-commit-message-1.0.0
# Reload VS Code window
```

---

## Troubleshooting

**`claude` binary not found**
The extension auto-detects `claude` via your login shell's `PATH` and a handful of common install locations (`~/.claude/local`, `~/.local/bin`, `~/.npm-global/bin`, `~/.npm/bin`, `/usr/local/bin`, `/opt/homebrew/bin`, `/usr/bin`). If none of those match your setup, set the full path in settings: `claudeCommit.claudePath` → `/home/youruser/.local/bin/claude`. This setting is machine-scoped — it is never synced by Settings Sync, so setting it on one PC can't break another.

**"VS Code disconnect" error in Claude window**
This is a known issue when `claude -p` inherits VS Code environment variables and tries to connect to the active MCP server. This extension strips those variables automatically. If you see it, make sure you're running extension version 1.0.0+.

**No message generated, no error shown**
Make sure you have staged changes (`git add` files first). The extension does nothing if `git diff --staged` is empty.

**Message appears in wrong repository**
When multiple repos are open, the extension uses the first one returned by the git API (`api.repositories[0]`). Click inside the target repo's file before generating.

---

## How it works internally

1. Runs `git diff --staged --no-color` in the repo root
2. Truncates the diff to `maxDiffLines` if needed
3. Builds a prompt based on your language/style/format settings
4. Spawns `claude -p` with a clean environment (VS Code vars stripped)
5. Strips any markdown fences from the output
6. Sets `repo.inputBox.value` in the VS Code Git API

---

## License

MIT © Eric Rodriguez
