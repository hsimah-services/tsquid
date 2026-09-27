import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generate } from '../index.mjs';

const FIXTURES = fileURLToPath(new URL('../../routes/tests/', import.meta.url));
const CLI = fileURLToPath(new URL('../bin/tsquid-codegen.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

test('output matches the generator fixture', () => {
  assert.equal(generate(readFileSync(join(FIXTURES, 'routes.json'), 'utf8')), readFileSync(join(FIXTURES, 'routes.generated.ts'), 'utf8'));
});
test('invalid configs throw the generator error', () => {
  assert.throws(() => generate('{"runtime":"x","routes":[{"name":"A","entryPoint":"A.ts","path":"/","fields":{}}]}'), /<Name>\.entrypoint\.ts/);
  assert.throws(() => generate('not json'), /expected/);
  assert.throws(() => generate('{"runtime":"x","routes":[],"extra":1}'), /unknown field/);
});
test('repeated calls reuse one instance without leaking earlier results', () => {
  const config = readFileSync(join(FIXTURES, 'routes.json'), 'utf8');
  assert.throws(() => generate('{}'));
  assert.equal(generate(config), generate(config));
});
test('CLI writes output, creating directories, and --check detects staleness', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tsquid-codegen-'));
  try {
    const output = join(dir, 'nested/routes.ts');
    assert.equal(run(join(FIXTURES, 'routes.json'), output).status, 0);
    assert.equal(run(join(FIXTURES, 'routes.json'), output, '--check').status, 0);
    writeFileSync(output, 'stale');
    const stale = run(join(FIXTURES, 'routes.json'), output, '--check');
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /stale/);
    assert.match(run(join(FIXTURES, 'routes.json')).stderr, /Usage/);
    assert.match(run(join(dir, 'missing.json'), output).stderr, /ENOENT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
