#!/usr/bin/env node
/**
 * Bump patch version y genera el .vsix listo para publicar.
 *
 * Uso:
 *   node scripts/package-vsix.mjs           → bump + package
 *   node scripts/package-vsix.mjs --dry-run → solo muestra qué haría
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');

const isDryRun = process.argv.includes('--dry-run');
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readPkg = () => JSON.parse(readFileSync(PKG_PATH, 'utf8'));

const bumpPatch = (version) => {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
};

const run = (cmd, args, label) => {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`"${label}" failed with exit code ${result.status ?? 'unknown'}`);
  }
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const currentVersion = readPkg().version;
const nextVersion = bumpPatch(currentVersion);
const outputFile = `${readPkg().name}-${nextVersion}.vsix`;

console.log('');
console.log('Claude Commit Message — VSIX Packager');
console.log('──────────────────────────────────────');
console.log(`  Current version : ${currentVersion}`);
console.log(`  Next version    : ${nextVersion}`);
console.log(`  Output file     : ${outputFile}`);

if (isDryRun) {
  console.log('\n  Dry run — nothing was changed.\n');
  process.exit(0);
}

// 1. Bump version in package.json
const pkg = readPkg();
pkg.version = nextVersion;
writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
console.log(`\n✓ package.json bumped to ${nextVersion}`);

// 2. Package VSIX (no build step needed — pure JS extension)
run(npxCmd, ['@vscode/vsce', 'package', '--out', outputFile, '--no-dependencies'], 'Packaging VSIX');

console.log(`\n✓ Done: ${outputFile}`);
console.log('');
console.log('  To install locally:');
console.log(`    code --install-extension ${outputFile}`);
console.log('');
console.log('  To publish:');
console.log(`    npx @vscode/vsce publish`);
console.log('');
