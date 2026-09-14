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

function getStagedDiff(repoPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['diff', '--staged', '--no-color'], { cwd: repoPath });
    let out = '', err = '';
    proc.stdout.on('data', d => (out += d));
    proc.stderr.on('data', d => (err += d));
    proc.on('close', code => code === 0 ? resolve(out) : reject(new Error(err || `git diff failed (${code})`)));
    proc.on('error', reject);
  });
}

// ─── Claude call ─────────────────────────────────────────────────────────────

function callClaude(bin, prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, ['-p'], { env: buildCleanEnv(), shell: false });
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
        reject(new Error(err.trim() || `claude exited with code ${code}`));
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

async function generateCommand() {
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
  const repo = api.repositories[0];
  if (!repo) { vscode.window.showErrorMessage('No git repository open.'); return; }

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
        vscode.window.showWarningMessage('No staged changes. Run git add first.'); return;
      }

      const lines = diff.split('\n');
      const diffToSend = lines.length > cfg.maxDiffLines
        ? lines.slice(0, cfg.maxDiffLines).join('\n') + `\n\n[diff truncated at ${cfg.maxDiffLines} of ${lines.length} lines]`
        : diff;

      let message;
      try {
        message = await callClaude(claudeBin, buildPrompt(cfg, diffToSend));
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
