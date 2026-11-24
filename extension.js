'use strict';

const vscode = require('vscode');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// ─── Prompt builder ───────────────────────────────────────────────────────────

const CONVENTIONAL_TYPES_ES = `feat, fix, refactor, chore, docs, style, test, perf, ci, build`;
const CONVENTIONAL_TYPES_EN = `feat, fix, refactor, chore, docs, style, test, perf, ci, build`;

const EMOJI_MAP = `✨ feat  🐛 fix  ♻️ refactor  📝 docs  🎨 style  ✅ test  🚀 perf  🔧 chore  👷 ci  📦 build`;

function buildPrompt(cfg, diff) {
  const es = cfg.language === 'spanish';
  const extended = cfg.style === 'extended';
  const scopeLine = cfg.includeScope
    ? (es ? '  - Incluí un scope entre paréntesis si aplica: feat(auth): ...' : '  - Include a scope in parentheses if applicable: feat(auth): ...')
    : (es ? '  - No incluyas scope.' : '  - Do not include a scope.');

  if (cfg.format === 'conventional') {
    if (es) {
      return extended
        ? `Analizá el siguiente git diff y generá un mensaje de commit siguiendo la especificación Conventional Commits.

Reglas:
  - Primera línea: <tipo>: <descripción corta en español, máximo 72 caracteres, sin punto final>
${scopeLine}
  - Tipos válidos: ${CONVENTIONAL_TYPES_ES}
  - Dejá una línea en blanco después del título
  - Agregá un cuerpo en español explicando el "por qué" del cambio (no el "qué", eso ya lo dice el código)
  - Si hay breaking changes: agrega footer "BREAKING CHANGE: <descripción>"
  - Si cierra un issue: agrega footer "Closes #N"
  - Respondé SOLO con el mensaje de commit, sin explicaciones ni markdown

Diff:
${diff}`
        : `Analizá el siguiente git diff y generá un mensaje de commit de UNA SOLA LÍNEA siguiendo Conventional Commits.

Reglas:
  - Formato: <tipo>: <descripción en español, máximo 72 caracteres, sin punto final>
${scopeLine}
  - Tipos válidos: ${CONVENTIONAL_TYPES_ES}
  - Solo una línea, sin cuerpo ni footers
  - Respondé SOLO con el mensaje, sin explicaciones ni markdown

Diff:
${diff}`;
    } else {
      return extended
        ? `Analyze the following git diff and generate a commit message following the Conventional Commits specification.

Rules:
  - First line: <type>: <short description in English, max 72 chars, no trailing period>
${scopeLine}
  - Valid types: ${CONVENTIONAL_TYPES_EN}
  - Leave a blank line after the title
  - Add a body in English explaining the "why" of the change (not the "what")
  - If there are breaking changes: add footer "BREAKING CHANGE: <description>"
  - If it closes an issue: add footer "Closes #N"
  - Reply ONLY with the commit message, no explanations or markdown

Diff:
${diff}`
        : `Analyze the following git diff and generate a ONE-LINE commit message following Conventional Commits.

Rules:
  - Format: <type>: <description in English, max 72 chars, no trailing period>
${scopeLine}
  - Valid types: ${CONVENTIONAL_TYPES_EN}
  - Single line only, no body or footers
  - Reply ONLY with the message, no explanations or markdown

Diff:
${diff}`;
    }
  }

  if (cfg.format === 'emoji') {
    const emojiRef = `Emoji reference: ${EMOJI_MAP}`;
    if (es) {
      return extended
        ? `Analizá el siguiente git diff y generá un mensaje de commit estilo gitmoji.

Reglas:
  - Primera línea: <emoji> <descripción corta en español, máximo 72 caracteres>
  - ${emojiRef}
  - Dejá una línea en blanco y agregá un cuerpo explicativo si el cambio lo justifica
  - Respondé SOLO con el mensaje, sin explicaciones ni markdown

Diff:
${diff}`
        : `Analizá el siguiente git diff y generá un mensaje de commit estilo gitmoji de UNA SOLA LÍNEA.

Reglas:
  - Formato: <emoji> <descripción en español, máximo 72 caracteres>
  - ${emojiRef}
  - Solo una línea
  - Respondé SOLO con el mensaje, sin explicaciones ni markdown

Diff:
${diff}`;
    } else {
      return extended
        ? `Analyze the following git diff and generate a gitmoji-style commit message.

Rules:
  - First line: <emoji> <short description in English, max 72 chars>
  - ${emojiRef}
  - Leave a blank line and add a body if the change justifies it
  - Reply ONLY with the message, no explanations or markdown

Diff:
${diff}`
        : `Analyze the following git diff and generate a ONE-LINE gitmoji-style commit message.

Rules:
  - Format: <emoji> <description in English, max 72 chars>
  - ${emojiRef}
  - Single line only
  - Reply ONLY with the message, no explanations or markdown

Diff:
${diff}`;
    }
  }

  // simple
  if (es) {
    return extended
      ? `Analizá el siguiente git diff y generá un mensaje de commit claro y descriptivo en español.

Reglas:
  - Primera línea: descripción corta (máximo 72 caracteres, sin punto final)
  - Dejá una línea en blanco y agregá un cuerpo si el cambio lo justifica
  - Sin prefijos ni emojis
  - Respondé SOLO con el mensaje, sin explicaciones ni markdown

Diff:
${diff}`
      : `Analizá el siguiente git diff y generá una descripción de commit clara y concisa en español, de UNA SOLA LÍNEA (máximo 72 caracteres, sin punto final, sin prefijos). Respondé SOLO con el mensaje.

Diff:
${diff}`;
  } else {
    return extended
      ? `Analyze the following git diff and generate a clear, descriptive commit message in English.

Rules:
  - First line: short description (max 72 chars, no trailing period)
  - Leave a blank line and add a body if the change justifies it
  - No prefixes or emojis
  - Reply ONLY with the message, no explanations or markdown

Diff:
${diff}`
      : `Analyze the following git diff and generate a clear, concise ONE-LINE commit message in English (max 72 chars, no trailing period, no prefix). Reply ONLY with the message.

Diff:
${diff}`;
  }
}

// ─── Environment ─────────────────────────────────────────────────────────────

function buildCleanEnv() {
  // Strip VS Code / Claude Code vars that cause the subprocess to try to
  // connect to the running MCP server and hang with a "disconnect" error.
  const STRIP = new Set([
    'CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_SESSION_ID',
    'CLAUDE_CODE_SSE_PORT', 'CLAUDE_CODE_ENTRYPOINT', 'AI_AGENT',
    'VSCODE_INJECTION', 'TERM_PROGRAM',
    // Set by the claude-with-memory wrapper. If VS Code inherited it, the
    // user's vault Stop hook blocks every `claude -p` run (exit 2) until a
    // session note exists, so the subprocess loops and ends empty / code 1.
    'MEMORY_PREFLIGHT_RECEIPT_ID',
  ]);
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!STRIP.has(k)) env[k] = v;
  }
  env.TERM_PROGRAM = 'xterm';
  env.HOME = os.homedir();
  return env;
}

// `claude` is installed in wildly different places depending on the machine
// and how it was installed (native installer, `npm install -g`, nvm, a
// custom prefix, ...) and the OS user can differ from PC to PC too. A single
// hardcoded fallback path breaks the moment either of those changes, and
// because `claudeCommit.claudePath` is a synced setting, fixing it on one PC
// used to silently break every other one. Resolve it fresh on every machine
// instead of trusting a stored absolute path.
function resolveViaLoginShell() {
  if (process.platform === 'win32') return null;
  const shell = process.env.SHELL || '/bin/bash';
  try {
    const out = execFileSync(shell, ['-lc', 'command -v claude'], { encoding: 'utf8', timeout: 3000 }).trim();
    return out && fs.existsSync(out) ? out : null;
  } catch {
    return null;
  }
}

function candidatePaths() {
  const home = os.homedir();
  return [
    path.join(home, '.claude', 'local', 'claude'),
    path.join(home, '.local', 'bin', 'claude'),
    path.join(home, '.npm-global', 'bin', 'claude'),
    path.join(home, '.npm', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    '/usr/bin/claude',
  ];
}

// Returns the resolved binary path, or null if nothing was found anywhere.
function resolveClaudeBin(configPath) {
  // An explicit user override is honored only while it still points at a
  // real file -- a stale synced path from another machine/user must not
  // block auto-detection on this one.
  if (configPath && fs.existsSync(configPath)) return configPath;

  const viaShell = resolveViaLoginShell();
  if (viaShell) return viaShell;

  return candidatePaths().find(p => fs.existsSync(p)) || null;
}

// ─── Git helpers ─────────────────────────────────────────────────────────────

// Generated / vendored files whose diff is huge and says nothing about intent.
// They still show up in the --stat summary, just without their content.
const NOISY_PATHSPECS = [
  '*.lock', '*-lock.json', '*-lock.yaml', 'npm-shrinkwrap.json', '*.min.js', '*.min.css',
  '*.map', '*.snap', '*.svg', 'dist/*', 'build/*', 'out/*', 'vendor/*',
].map(p => `:(exclude,glob)**/${p}`);

function runGit(repoPath, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd: repoPath });
    let out = '', err = '';
    proc.stdout.on('data', d => (out += d));
    proc.stderr.on('data', d => (err += d));
    proc.on('close', code => code === 0 ? resolve(out) : reject(new Error(err || `git ${args[0]} failed (${code})`)));
    proc.on('error', reject);
  });
}

async function getStagedDiff(repoPath) {
  const stat = await runGit(repoPath, ['diff', '--staged', '--no-color', '--stat=200']);
  if (!stat.trim()) return '';
  const diff = await runGit(repoPath, ['diff', '--staged', '--no-color', '--', '.', ...NOISY_PATHSPECS]);
  return `Files changed:\n${stat}\n${diff}`;
}

const MAX_LINE_CHARS = 400;

// Keeps the prompt bounded and inert:
//  - long lines (minified code, base64, JSON blobs) are clipped,
//  - the total is capped by lines AND characters (500 lines of 50 KB each is
//    still ~6M tokens),
//  - every "@" gets a zero-width space after it, because `claude -p` expands
//    "@path" mentions in the prompt into attached file/folder contents — a diff
//    full of `@angular/core` or `@/src/...` imports pulled in >500k tokens.
function prepareDiff(diff, maxLines, maxChars) {
  let lines = diff.split('\n').map(l => l.length > MAX_LINE_CHARS ? l.slice(0, MAX_LINE_CHARS) + ' …[line clipped]' : l);
  const notes = [];
  if (lines.length > maxLines) {
    notes.push(`truncated at ${maxLines} of ${lines.length} lines`);
    lines = lines.slice(0, maxLines);
  }
  let text = lines.join('\n');
  if (text.length > maxChars) {
    notes.push(`truncated at ${maxChars} characters`);
    text = text.slice(0, maxChars);
  }
  if (notes.length) text += `\n\n[diff ${notes.join(', ')}]`;
  return text.replace(/@/g, '@​');
}

// Empty scratch dir used as the subprocess cwd so `claude -p` doesn't load the
// repo's CLAUDE.md / project memory or resolve relative paths inside it.
function neutralCwd() {
  const dir = path.join(os.tmpdir(), 'claude-commit-message');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Picks the repository the user actually meant when several are open in the
// same window. The scm/title button passes the clicked SourceControl as arg.
async function pickRepository(api, arg) {
  const repos = api.repositories;
  if (repos.length <= 1) return repos[0];

  const argRoot = arg && arg.rootUri && arg.rootUri.fsPath;
  if (argRoot) {
    const match = repos.find(r => r.rootUri.fsPath === argRoot);
    if (match) return match;
  }

  const selected = repos.filter(r => r.ui && r.ui.selected);
  if (selected.length === 1) return selected[0];

  const editorUri = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri;
  if (editorUri && editorUri.scheme === 'file') {
    const owner = api.getRepository && api.getRepository(editorUri);
    if (owner && owner.state.indexChanges.length > 0) return owner;
  }

  const withStaged = repos.filter(r => r.state.indexChanges.length > 0);
  if (withStaged.length === 1) return withStaged[0];

  const candidates = withStaged.length > 0 ? withStaged : repos;
  const picked = await vscode.window.showQuickPick(
    candidates.map(r => ({
      label: path.basename(r.rootUri.fsPath),
      description: `${r.state.indexChanges.length} staged`,
      detail: r.rootUri.fsPath,
      repo: r,
    })),
    { placeHolder: 'Select the repository to generate a commit message for' }
  );
  return picked && picked.repo;
}

// ─── Claude call ─────────────────────────────────────────────────────────────

// Generating a commit message is a single text completion: no tools, no
// skills, no MCP servers, no saved session. Without these flags `claude -p`
// behaves like a full agent session (global CLAUDE.md instructions, hooks,
// tool calls that get denied in -p mode) and often finishes with empty output.
function claudeArgs(model) {
  const args = ['-p', '--tools', '', '--disable-slash-commands', '--strict-mcp-config', '--no-session-persistence'];
  if (model) args.push('--model', model);
  return args;
}

function callClaude(bin, prompt, model, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, claudeArgs(model), { env: buildCleanEnv(), shell: false, cwd });
    let out = '', err = '';
    proc.stdout.on('data', d => (out += d));
    proc.stderr.on('data', d => (err += d));
    proc.stdin.write(prompt, 'utf8');
    proc.stdin.end();
    proc.on('close', code => {
      if (code === 0 && out.trim()) {
        const clean = out.trim().replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
        resolve(clean);
      } else {
        const detail = err.trim() || out.trim();
        reject(new Error(detail
          ? `claude exited with code ${code}: ${detail.slice(0, 500)}`
          : `claude exited with code ${code} and no output (check Stop hooks in ~/.claude/settings.json)`));
      }
    });
    proc.on('error', e => {
      reject(e.code === 'ENOENT'
        ? new Error(`claude binary not found at: ${bin}\nSet the path in Settings → Claude Commit Message → Claude Path`)
        : e);
    });
  });
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function getConfig() {
  const c = vscode.workspace.getConfiguration('claudeCommit');
  return {
    language:     c.get('language', 'spanish'),
    style:        c.get('style', 'short'),
    format:       c.get('format', 'conventional'),
    includeScope: c.get('includeScope', false),
    claudePath:   c.get('claudePath', ''),
    maxDiffLines: c.get('maxDiffLines', 500),
    maxDiffChars: c.get('maxDiffChars', 60000),
    model:        c.get('model', 'haiku'),
  };
}

async function saveConfig(key, value) {
  await vscode.workspace.getConfiguration('claudeCommit')
    .update(key, value, vscode.ConfigurationTarget.Global);
}

// ─── Configure command ────────────────────────────────────────────────────────

async function configureCommand() {
  const cfg = getConfig();

  const LABELS = {
    language:     { spanish: '🇦🇷  Español', english: '🇺🇸  English' },
    style:        { short: '📝  Short (single line)', extended: '📄  Extended (title + body)' },
    format:       { conventional: '🔖  Conventional Commits', emoji: '✨  Emoji (gitmoji)', simple: '💬  Simple (no prefix)' },
    includeScope: { true: '🔍  Include scope  (feat(auth): ...)', false: '➖  No scope  (feat: ...)' },
  };

  const check = (setting, key) => cfg[setting] === key || String(cfg[setting]) === String(key) ? '$(check) ' : '      ';

  while (true) {
    const pick = await vscode.window.showQuickPick(
      [
        { label: '$(globe) Language', kind: vscode.QuickPickItemKind.Separator },
        { label: `${check('language','spanish')}${LABELS.language.spanish}`,   setting: 'language', value: 'spanish' },
        { label: `${check('language','english')}${LABELS.language.english}`,   setting: 'language', value: 'english' },
        { label: '$(edit) Style', kind: vscode.QuickPickItemKind.Separator },
        { label: `${check('style','short')}${LABELS.style.short}`,       setting: 'style', value: 'short' },
        { label: `${check('style','extended')}${LABELS.style.extended}`, setting: 'style', value: 'extended' },
        { label: '$(symbol-keyword) Format', kind: vscode.QuickPickItemKind.Separator },
        { label: `${check('format','conventional')}${LABELS.format.conventional}`, setting: 'format', value: 'conventional' },
        { label: `${check('format','emoji')}${LABELS.format.emoji}`,               setting: 'format', value: 'emoji' },
        { label: `${check('format','simple')}${LABELS.format.simple}`,             setting: 'format', value: 'simple' },
        { label: '$(symbol-namespace) Scope', kind: vscode.QuickPickItemKind.Separator },
        { label: `${check('includeScope', false)}${LABELS.includeScope.false}`, setting: 'includeScope', value: false },
        { label: `${check('includeScope', true)}${LABELS.includeScope.true}`,   setting: 'includeScope', value: true },
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        { label: '$(close) Close', close: true },
      ],
      {
        title: 'Claude Commit — Configuration (changes are saved globally)',
        placeHolder: 'Select an option to toggle it',
        ignoreFocusOut: true,
      }
    );

    if (!pick || pick.close) break;
    if (pick.kind === vscode.QuickPickItemKind.Separator) continue;

    await saveConfig(pick.setting, pick.value);
    // Update local cfg so checkmarks refresh immediately
    cfg[pick.setting] = pick.value;
  }
}

// ─── Generate command ─────────────────────────────────────────────────────────

async function generateCommand(arg) {
  const cfg = getConfig();
  const claudeBin = resolveClaudeBin(cfg.claudePath);
  if (!claudeBin) {
    vscode.window.showErrorMessage(
      "Claude Commit: couldn't find the `claude` binary (checked PATH via your login shell, " +
      '~/.claude/local, ~/.local/bin, ~/.npm-global/bin, ~/.npm/bin and common system paths). ' +
      'Install Claude Code or set claudeCommit.claudePath manually for this machine.'
    );
    return;
  }

  const gitExt = vscode.extensions.getExtension('vscode.git');
  if (!gitExt) { vscode.window.showErrorMessage('Git extension not found.'); return; }

  const api = gitExt.exports.getAPI(1);
  if (api.repositories.length === 0) { vscode.window.showErrorMessage('No git repository open.'); return; }
  const repo = await pickRepository(api, arg);
  if (!repo) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Claude: generating commit message…', cancellable: false },
    async () => {
      let diff;
      try {
        diff = await getStagedDiff(repo.rootUri.fsPath);
      } catch (e) {
        vscode.window.showErrorMessage(`git diff failed: ${e.message}`); return;
      }

      if (!diff.trim()) {
        vscode.window.showWarningMessage(`No staged changes in ${path.basename(repo.rootUri.fsPath)}. Run git add first.`); return;
      }

      const diffToSend = prepareDiff(diff, cfg.maxDiffLines, cfg.maxDiffChars);

      let message;
      try {
        message = await callClaude(claudeBin, buildPrompt(cfg, diffToSend), cfg.model, neutralCwd());
      } catch (e) {
        vscode.window.showErrorMessage(`Claude error: ${e.message}`); return;
      }

      repo.inputBox.value = message;
    }
  );
}

// ─── Activation ──────────────────────────────────────────────────────────────

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCommit.generate', generateCommand),
    vscode.commands.registerCommand('claudeCommit.configure', configureCommand),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
