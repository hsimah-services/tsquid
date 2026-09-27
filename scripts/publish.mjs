#!/usr/bin/env node
// Stages each public package under packages/ whose version isn't on npm yet.
// `pnpm pack` runs prepack builds and applies publishConfig and workspace: ranges;
// `npm stage publish` uploads the tarball. A maintainer then publishes it with
// `npm stage approve` (2FA). Every package is attempted; failures are reported at the end.
//
//   node scripts/publish.mjs [--dry-run]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const PACKAGES = new URL('../packages/', import.meta.url);

const staged = [];
const failed = [];
for (const dir of readdirSync(PACKAGES)) {
  const cwd = new URL(`${dir}/`, PACKAGES);
  const { name, version, private: isPrivate } = JSON.parse(readFileSync(new URL('package.json', cwd), 'utf8'));
  if (isPrivate) continue;
  const spec = `${name}@${version}`;
  if (isPublished(name, version)) {
    console.log(`${spec} is already published`);
    continue;
  }
  const out = mkdtempSync(join(tmpdir(), 'tsquid-pack-'));
  try {
    execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd, stdio: 'inherit' });
    const [tarball] = readdirSync(out);
    execFileSync('npm', ['stage', 'publish', join(out, tarball), '--access', 'public', ...(DRY_RUN ? ['--dry-run'] : [])], { stdio: 'inherit' });
    staged.push(spec);
  } catch (error) {
    failed.push(`${spec}: ${error.message.split('\n')[0]}`);
  } finally { rmSync(out, { recursive: true, force: true }); }
}

console.log(`\nStaged: ${staged.join(', ') || 'none'}`);
if (staged.length && !DRY_RUN) console.log('Approve with 2FA: npm stage list, then npm stage approve <stage-id>');
if (failed.length) {
  console.error(`Failed:\n  ${failed.join('\n  ')}`);
  process.exitCode = 1;
}

function isPublished(name, version) {
  try {
    return execFileSync('npm', ['view', `${name}@${version}`, 'version'], { encoding: 'utf8', stdio: 'pipe' }).trim() === version;
  } catch {
    return false; // E404: the package or this version doesn't exist yet.
  }
}
