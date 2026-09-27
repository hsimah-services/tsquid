import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/create-tsquid.mjs', import.meta.url));
const PACKAGES = new URL('../../', import.meta.url);
const run = (cwd, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
const read = (...path) => readFileSync(join(...path), 'utf8');

function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'create-tsquid-'));
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('creates a named app pinned to the sibling package versions', () => withTemp(dir => {
  const result = run(dir, 'My App');
  assert.equal(result.status, 0, result.stderr);
  const app = join(dir, 'My App');
  const manifest = JSON.parse(read(app, 'package.json'));
  assert.equal(manifest.name, 'my-app');
  assert.match(manifest.packageManager, /^pnpm@/);
  for (const name of ['routes', 'codegen', 'vite', 'eslint-plugin']) {
    const { version } = JSON.parse(readFileSync(new URL(`${name}/package.json`, PACKAGES), 'utf8'));
    const range = manifest.dependencies[`@tsquid/${name}`] ?? manifest.devDependencies[`@tsquid/${name}`];
    assert.equal(range, `^${version}`, name);
  }
  assert.doesNotMatch(read(app, 'package.json'), /workspace:/);
  assert.ok(existsSync(join(app, '.gitignore')) && !existsSync(join(app, 'gitignore')));
  assert.ok(existsSync(join(app, 'pnpm-workspace.yaml')));
  assert.ok(existsSync(join(app, 'src/routes/__generated__/routes.ts')));
  assert.ok(!existsSync(join(app, 'node_modules')) && !existsSync(join(app, 'dist')));
  assert.equal(statSync(join(app, 'scripts/toolchain.sh')).mode & 0o111, 0o111);
  assert.match(read(app, 'README.md'), /^# my-app$/m);
  assert.match(read(app, 'index.html'), /<title>my-app<\/title>/);
}));

test('refuses a non-empty directory and bad arguments', () => withTemp(dir => {
  mkdirSync(join(dir, 'taken'));
  writeFileSync(join(dir, 'taken/file'), '');
  assert.match(run(dir, 'taken').stderr, /not empty/);
  assert.match(run(dir).stderr, /Usage/);
  assert.match(run(dir, 'a', 'b').stderr, /Usage/);
}));
