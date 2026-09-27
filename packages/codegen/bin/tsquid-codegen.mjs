#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { generate } from '../index.mjs';

const args = process.argv.slice(2);
try {
  if (args.length < 2 || args.length > 3 || (args.length === 3 && args[2] !== '--check')) {
    throw new Error('Usage: tsquid-codegen CONFIG.json OUTPUT.ts [--check]');
  }
  const [config, output, check] = args;
  const generated = generate(readFileSync(config, 'utf8'));
  if (check) {
    if (read(output) !== generated) throw new Error('Generated routes are stale; regenerate them');
  } else {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, generated);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

function read(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}
