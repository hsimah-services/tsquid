#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { generate, manifest } from '../index.mjs';

const args = process.argv.slice(2);
try {
  if (args.length < 2 || args.length > 3 || (args.length === 3 && args[2] !== '--check')) {
    throw new Error('Usage: tsquid-codegen CONFIG.json OUTPUT.ts [--check]');
  }
  const [config, output, check] = args;
  const source = readFileSync(config, 'utf8');
  const persisted = persistedQueriesPath(source);
  const queries = persisted === null ? null : readFileSync(resolve(dirname(config), persisted), 'utf8');
  // Generate both before writing either: output is all-or-nothing.
  const files = [[output, generate(source, queries)], [output.replace(/\.ts$/, '') + '.manifest.json', manifest(source, queries)]];
  if (check) {
    if (files.some(([path, generated]) => read(path) !== generated)) throw new Error('Generated routes are stale; regenerate them');
  } else {
    mkdirSync(dirname(output), { recursive: true });
    for (const [path, generated] of files) writeFileSync(path, generated);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

// The generator reports invalid configs; this only finds the file it needs.
function persistedQueriesPath(source) {
  try {
    const path = JSON.parse(source).persistedQueries;
    return typeof path === 'string' ? path : null;
  } catch { return null; }
}

function read(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}
