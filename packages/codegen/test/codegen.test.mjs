import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generate, manifest } from '../index.mjs';

const FIXTURES = fileURLToPath(new URL('../../routes/tests/', import.meta.url));
const CLI = fileURLToPath(new URL('../bin/tsquid-codegen.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

const fixture = () => [readFileSync(join(FIXTURES, 'routes.json'), 'utf8'), readFileSync(join(FIXTURES, 'persisted_queries.json'), 'utf8')];
test('output matches the generator fixture', () => {
  assert.equal(generate(...fixture()), readFileSync(join(FIXTURES, 'routes.generated.ts'), 'utf8'));
});
test('manifest matches the generator fixture and flags non-SSR routes', () => {
  const output = manifest(...fixture());
  assert.equal(output, readFileSync(join(FIXTURES, 'routes.generated.manifest.json'), 'utf8'));
  assert.deepEqual(JSON.parse(output).routes.map(route => [route.name, route.ssr, route.query?.operation]), [['Tutorials', true, undefined], ['TutorialDetail', true, 'TutorialDetailQuery'], ['Playlists', false, undefined]]);
  assert.throws(() => manifest(fixture()[0]), /Persisted queries were not provided/);
  assert.throws(() => manifest('{"runtime":"x","routes":[{"name":"A","entryPoint":"A.ts","path":"/","fields":{}}]}'), /<Name>\.entrypoint\.ts/);
});
test('invalid configs throw the generator error', () => {
  assert.throws(() => generate('{"runtime":"x","routes":[{"name":"A","entryPoint":"A.ts","path":"/","fields":{}}]}'), /<Name>\.entrypoint\.ts/);
  assert.throws(() => generate('not json'), /expected/);
  assert.throws(() => generate('{"runtime":"x","routes":[],"extra":1}'), /unknown field/);
});
test('repeated calls reuse one instance without leaking earlier results', () => {
  assert.throws(() => generate('{}'));
  assert.equal(generate(...fixture()), generate(...fixture()));
});
test('CLI writes output, creating directories, and --check detects staleness', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tsquid-codegen-'));
  try {
    const output = join(dir, 'nested/routes.ts');
    const manifestOutput = join(dir, 'nested/routes.manifest.json');
    assert.equal(run(join(FIXTURES, 'routes.json'), output).status, 0);
    assert.equal(readFileSync(manifestOutput, 'utf8'), readFileSync(join(FIXTURES, 'routes.generated.manifest.json'), 'utf8'));
    assert.equal(run(join(FIXTURES, 'routes.json'), output, '--check').status, 0);
    for (const path of [output, manifestOutput]) {
      const current = readFileSync(path, 'utf8');
      writeFileSync(path, 'stale');
      const stale = run(join(FIXTURES, 'routes.json'), output, '--check');
      assert.equal(stale.status, 1);
      assert.match(stale.stderr, /stale/);
      writeFileSync(path, current);
    }
    assert.match(run(join(FIXTURES, 'routes.json')).stderr, /Usage/);
    assert.match(run(join(dir, 'missing.json'), output).stderr, /ENOENT/);
    const config = join(dir, 'routes.json');
    writeFileSync(config, readFileSync(join(FIXTURES, 'routes.json'), 'utf8'));
    assert.match(run(config, output).stderr, /ENOENT.*persisted_queries\.json/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
