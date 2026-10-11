#!/usr/bin/env node
import { globSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

try {
  const args = process.argv.slice(2);
  const watch = args.includes('--watch');
  const positional = args.filter(arg => arg !== '--watch');
  const [command, filename = 'relay.config.json'] = positional;
  if (!['persist', 'check'].includes(command) || positional.length > 2 || args.some(arg => arg.startsWith('--') && arg !== '--watch') || (watch && command !== 'persist')) throw new Error('Usage: tsquid-relay persist [relay-config.json] [--watch] | check [relay-config.json]');
  const configPath = resolve(filename);
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (typeof config.persistConfig?.file !== 'string') throw new Error('Relay config requires persistConfig.file');
  const persistedPath = resolve(dirname(configPath), config.persistConfig.file);
  if (command === 'persist') {
    let previous;
    try { previous = readFileSync(persistedPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    mkdirSync(dirname(persistedPath), { recursive: true });
    writeFileSync(persistedPath, '{}\n');
    const result = spawnSync('relay-compiler', [configPath, '--repersist', ...(watch ? ['--watch'] : [])], { stdio: 'inherit' });
    if (result.error || result.status !== 0) {
      if (previous !== undefined && (result.error || !watch)) writeFileSync(persistedPath, previous);
      if (result.error) throw result.error;
      throw new Error(`relay-compiler failed (${result.signal ?? result.status})`);
    }
  } else {
    if (typeof (config.artifactDirectory ?? config.src) !== 'string') throw new Error('Relay config requires src or artifactDirectory');
    const root = resolve(dirname(configPath), config.artifactDirectory ?? config.src);
    if (!statSync(root).isDirectory()) throw new Error(`Artifact root is not a directory: ${root}`);
    // Relay excludes generated directories from source scanning; we need those artifacts.
    const exclude = (config.excludes ?? ['**/node_modules/**', '**/__mocks__/**', '**/__generated__/**']).filter(pattern => !pattern.includes('__generated__') && !pattern.includes('node_modules'));
    const dependency = file => file.split(/[\\/]/).includes('node_modules');
    const excluded = new Set(exclude.flatMap(pattern => globSync(pattern, { cwd: root, exclude: dependency })));
    const ids = new Set();
    for (const file of globSync('**/*.graphql.{ts,js}', { cwd: root, exclude: file => dependency(file) || excluded.has(file) }).sort()) {
      const source = readFileSync(resolve(root, file), 'utf8');
      if (!/"params"\s*:/.test(source)) continue;
      const id = source.match(/"params"\s*:\s*\{[\s\S]*?"id"\s*:\s*("(?:[^"\\]|\\.)*"|null)/)?.[1];
      if (!id || id === 'null') throw new Error(`Missing persisted operation id: ${file}`);
      ids.add(JSON.parse(id));
    }
    const persisted = JSON.parse(readFileSync(persistedPath, 'utf8'));
    if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted) || Object.values(persisted).some(value => typeof value !== 'string')) throw new Error('Invalid persisted queries');
    const missing = [...ids].filter(id => !Object.hasOwn(persisted, id)).sort();
    const stale = Object.keys(persisted).filter(id => !ids.has(id)).sort();
    if (missing.length || stale.length) throw new Error(`Persisted queries differ; missing: ${missing.join(', ') || 'none'}; stale: ${stale.join(', ') || 'none'}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
