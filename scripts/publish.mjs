#!/usr/bin/env node
// Publishes each public package under packages/ whose version isn't on npm yet.
// `pnpm pack` runs prepack builds and applies publishConfig and workspace: ranges;
// `npm publish` uploads the tarball (npm >= 11.5.1 for trusted publishing from CI).
//
//   node scripts/publish.mjs [--dry-run]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const PACKAGES = new URL('../packages/', import.meta.url);

for (const dir of readdirSync(PACKAGES)) {
  const cwd = new URL(`${dir}/`, PACKAGES);
  const { name, version, private: isPrivate } = JSON.parse(readFileSync(new URL('package.json', cwd), 'utf8'));
  if (isPrivate) continue;
  if (isPublished(name, version)) {
    console.log(`${name}@${version} is already published`);
    continue;
  }
  const out = mkdtempSync(join(tmpdir(), 'tsquid-pack-'));
  try {
    execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd, stdio: 'inherit' });
    const [tarball] = readdirSync(out);
    execFileSync('npm', ['publish', join(out, tarball), '--access', 'public', ...(DRY_RUN ? ['--dry-run'] : [])], { stdio: 'inherit' });
  } finally { rmSync(out, { recursive: true, force: true }); }
}

function isPublished(name, version) {
  try {
    return execFileSync('npm', ['view', `${name}@${version}`, 'version'], { encoding: 'utf8', stdio: 'pipe' }).trim() === version;
  } catch {
    return false; // E404: the package or this version doesn't exist yet.
  }
}
