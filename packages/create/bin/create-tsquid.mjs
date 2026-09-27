#!/usr/bin/env node
// pnpm create @tsquid <directory>
import { chmodSync, cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = fileURLToPath(new URL('../template/', import.meta.url));
const EXECUTABLES = ['scripts/toolchain.sh', 'scripts/dev.sh', 'scripts/fetch-schema.mjs'];

const [dir, ...extra] = process.argv.slice(2);
if (!dir || dir.startsWith('-') || extra.length) fail('Usage: pnpm create @tsquid <directory>');
const target = resolve(dir);
if (existsSync(target) && readdirSync(target).length) fail(`${dir} exists and is not empty`);
const name = basename(target).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');

cpSync(TEMPLATE, target, { recursive: true });
renameSync(join(target, 'gitignore'), join(target, '.gitignore'));
for (const file of EXECUTABLES) chmodSync(join(target, file), 0o755);
const manifest = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
writeFileSync(join(target, 'package.json'), JSON.stringify({ ...manifest, name }, null, 2) + '\n');
edit('README.md', text => text.replace(/^# tsquid app$/m, `# ${name}`));
edit('index.html', text => text.replace('<title>tsquid app</title>', `<title>${name}</title>`));

console.log(`Created ${name}.

  cd ${relative(process.cwd(), target) || '.'}
  scripts/toolchain.sh pnpm install
  scripts/dev.sh`);

function edit(file, change) {
  writeFileSync(join(target, file), change(readFileSync(join(target, file), 'utf8')));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
