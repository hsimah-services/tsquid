import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/tsquid-relay.mjs', import.meta.url));
test('Relay check detects missing/stale ids, excludes source dirs, and supports custom artifacts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tsquid-relay-'));
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8' });
  const write = (file, value) => { mkdirSync(join(dir, file, '..'), { recursive: true }); writeFileSync(join(dir, file), value); };
  try {
    const config = { src: 'src', excludes: ['**/__generated__/**', '**/__mocks__/**'], persistConfig: { file: 'persisted.json' } };
    write('relay.config.json', JSON.stringify(config));
    write('src/entity/__generated__/Query.graphql.ts', 'const node = { "params": { "cacheID": "cache", "id": "q1", "name": "Query" } };');
    write('src/entity/__generated__/Fragment.graphql.ts', 'const node = { "kind": "Fragment" };');
    write('src/__mocks__/Ignored.graphql.ts', 'const node = { "params": { "id": "ignored" } };');
    write('src/App.ts', 'throw new Error("Never read application TS");');
    write('persisted.json', JSON.stringify({ q1: 'query Query { id }' }));
    assert.equal(run('check').status, 0);
    write('persisted.json', JSON.stringify({ stale: 'query Old { id }' }));
    const drift = run('check');
    assert.equal(drift.status, 1);
    assert.match(drift.stderr, /missing: q1; stale: stale/);
    write('node_modules/x/__generated__/Dep.graphql.js', 'const node = { "params": { "id": "dependency" } };');
    write('relay.config.json', JSON.stringify({ src: '.', persistConfig: config.persistConfig }));
    write('persisted.json', JSON.stringify({ q1: 'query Query { id }' }));
    assert.equal(run('check').status, 0);
    write('custom/Query.graphql.js', 'const node = { "params": { "id": "custom" } };');
    write('relay.config.json', JSON.stringify({ ...config, artifactDirectory: 'custom' }));
    write('persisted.json', JSON.stringify({ custom: 'query Custom { id }' }));
    assert.equal(run('check').status, 0);
    write('custom/Query.graphql.js', 'const node = { "params": { "id": null } };');
    assert.match(run('check').stderr, /Missing persisted operation id/);
    assert.match(run('check', '--watch').stderr, /Usage/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Relay persist resets the configured file, forwards watch, and preserves previous data on failure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tsquid-persist-'));
  try {
    mkdirSync(join(dir, 'bin'));
    writeFileSync(join(dir, 'relay.config.json'), JSON.stringify({ src: 'src', persistConfig: { file: 'persisted.json' } }));
    writeFileSync(join(dir, 'persisted.json'), '{"old":"query Old { id }"}');
    const compiler = join(dir, 'bin/relay-compiler');
    writeFileSync(compiler, `#!/usr/bin/env node
import fs from 'node:fs';
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (fs.readFileSync(config.persistConfig.file, 'utf8') !== '{}\\n') process.exit(2);
fs.writeFileSync('args.json', JSON.stringify(process.argv.slice(2)));
if (process.env.FAIL) process.exit(1);
fs.writeFileSync(config.persistConfig.file, '{"new":"query New { id }"}');
`);
    chmodSync(compiler, 0o755);
    const run = (args, env = {}) => spawnSync(process.execPath, [CLI, ...args], { cwd: dir, env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, ...env }, encoding: 'utf8' });
    assert.equal(run(['persist', '--watch']).status, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'args.json'))).slice(1), ['--repersist', '--watch']);
    const current = readFileSync(join(dir, 'persisted.json'), 'utf8');
    assert.equal(run(['persist'], { FAIL: '1' }).status, 1);
    assert.equal(readFileSync(join(dir, 'persisted.json'), 'utf8'), current);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
