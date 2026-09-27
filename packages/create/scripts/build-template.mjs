// Copies templates/app into ./template for packing. workspace: ranges become the
// sibling packages' versions, and .gitignore is renamed because npm won't pack it.
import { cpSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../../', import.meta.url);
const TARGET = new URL('../template/', import.meta.url);
const SKIP = /\/(node_modules|dist|\.vite)(\/|$)/;

rmSync(TARGET, { recursive: true, force: true });
cpSync(new URL('templates/app/', ROOT), TARGET, { recursive: true, filter: source => !SKIP.test(source) });
renameSync(new URL('.gitignore', TARGET), new URL('gitignore', TARGET));

const { packageManager } = readJson(new URL('package.json', ROOT));
const { name, version, type, ...rest } = readJson(new URL('package.json', TARGET));
const manifest = { name, version, type, packageManager, ...rest };
for (const field of ['dependencies', 'devDependencies']) {
  for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
    if (!range.startsWith('workspace:')) continue;
    const packageDir = dependency.replace(/^@tsquid\//, '');
    manifest[field][dependency] = `^${readJson(new URL(`packages/${packageDir}/package.json`, ROOT)).version}`;
  }
}
writeFileSync(new URL('package.json', TARGET), JSON.stringify(manifest, null, 2) + '\n');
// The starter can't carry this in the repo: it would split the workspace.
writeFileSync(new URL('pnpm-workspace.yaml', TARGET), `allowBuilds:
  '@astryxdesign/cli': true
  '@astryxdesign/core': true
onlyBuiltDependencies:
  - "@astryxdesign/cli"
  - "@astryxdesign/core"
`);
console.log(`Built ${fileURLToPath(TARGET)}`);

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}
